import {
  DEFAULT_EXPLAIN_LANGUAGE,
  MAX_CONTEXT_CHARS,
  MAX_EXPLAIN_INPUT_CHARS,
  type ExplainContextKind,
} from '@qeri/shared';
import type { SiteAdapter, SiteExtraction } from './types';

/**
 * X extraction adapter — implements the SiteAdapter contract (plan.md §Phase 2).
 *
 * This is the ONLY module that knows X's DOM, so DOM churn can never break the
 * engine, the panel, or the backend. Selectors were chosen against the real feed:
 * - `[data-testid="tweet"]`  — the article element rendered per post
 * - `[data-testid="tweetText"]` — the post's rich text container
 * - `[data-testid="User-Name"]` — the author row ("Display Name@handle ·")
 * - `a[href*="/status/"]` — the permalink anchor (bookmarkable status URL)
 * - `section[aria-labelledby]` — the conversation wrapper on status detail pages
 *
 * Purity rule (SiteAdapter contract): extract() never reads window.location or
 * the registry's decision — everything it needs must be in the article element.
 * This is what makes the adapter testable against recorded HTML fixtures.
 */
export const X_SELECTORS = {
  hosts: [
    'x.com',
    'www.x.com',
    'twitter.com',
    'www.twitter.com',
    'mobile.twitter.com',
  ] as readonly string[],
  article: 'article[data-testid="tweet"]',
  body: '[data-testid="tweetText"]',
  authorName: '[data-testid="User-Name"]',
  permalink: 'a[href*="/status/"]',
  conversationSection: 'section[aria-labelledby]',
} as const;

export const xAdapter: SiteAdapter = {
  id: 'x',

  isOwner(hostname: string): boolean {
    return X_SELECTORS.hosts.includes(hostname);
  },

  postSelector: X_SELECTORS.article,

  extract(article: HTMLElement): SiteExtraction | null {
    return extractPost(article);
  },
};

/* ------------------------------------------------------------------------- */
/* Extraction pipeline                                                       */
/* ------------------------------------------------------------------------- */

function extractPost(article: HTMLElement): SiteExtraction | null {
  const text = extractText(article);
  if (!text) return null; // media-only posts and empty shells are skipped

  const permalink = extractPermalink(article);
  const context = extractContext(article);

  return {
    element: article,
    request: {
      text: truncate(text, MAX_EXPLAIN_INPUT_CHARS),
      authorHandle: extractHandle(article),
      sourceUrl: permalink?.url ?? null,
      statusId: permalink?.id ?? null,
      context: context?.text ?? null,
      contextKind: context?.kind ?? null,
      mode: 'simple',
      language: navigator.language.slice(0, 2) || DEFAULT_EXPLAIN_LANGUAGE,
    },
  };
}

/** Quoted-post context wins over parent context when both are present. */
function extractContext(article: HTMLElement): { text: string; kind: ExplainContextKind } | null {
  return extractQuotedContext(article) ?? extractParentContext(article);
}

/**
 * A quoted post is an article nested INSIDE the main article (X renders it boxed).
 * Its text is the main post's context — "this post quotes another post".
 */
function extractQuotedContext(article: HTMLElement): ThreadContext | null {
  const quoted = article.querySelector<HTMLElement>(X_SELECTORS.article);
  if (!quoted) return null;
  const text = extractText(quoted);
  return text ? makeContext(text, 'quoted') : null;
}

/**
 * On status detail pages the conversation lives inside one `section`; the FIRST
 * article there is the thread root, and every later article is a reply to (some
 * ancestor in) it. Parent context = the root's text, labeled "parent".
 */
function extractParentContext(article: HTMLElement): ThreadContext | null {
  const section = article.closest<HTMLElement>(X_SELECTORS.conversationSection);
  if (!section) return null;

  const articles = Array.from(section.querySelectorAll<HTMLElement>(X_SELECTORS.article));
  const root = articles[0];
  if (!root || root === article) return null;

  const text = extractText(root);
  return text ? makeContext(text, 'parent') : null;
}

interface ThreadContext {
  text: string;
  kind: ExplainContextKind;
}

/** Build a valid (schema-shaped) context blob — truncation + kind together. */
function makeContext(text: string, kind: ExplainContextKind): ThreadContext {
  return { text: truncate(text, MAX_CONTEXT_CHARS), kind };
}

function extractText(article: HTMLElement): string | null {
  const body = article.querySelector<HTMLElement>(X_SELECTORS.body);
  const raw = normalizeWhitespace(body?.innerText ?? '');
  return raw.length > 0 ? raw : null;
}

/* ------------------------------------------------------------------------- */
/* Text shaping                                                              */
/* ------------------------------------------------------------------------- */

/** Whitespace normalization: collapse runs, keep single newlines, trim ends. */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Truncation with a clean tail: cut at the cap, then back up to the last word
 * boundary when the result stays respectable (>=60% of the cap kept).
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, Math.max(0, max - 1));
  const boundary = slice.lastIndexOf(' ');
  const kept = boundary > max * 0.6 ? slice.slice(0, boundary) : slice;
  return `${kept.trimEnd()}\u2026`;
}

/* ------------------------------------------------------------------------- */
/* Field extraction                                                          */
/* ------------------------------------------------------------------------- */

function extractHandle(article: HTMLElement): string | null {
  const nameRow = article.querySelector<HTMLElement>(X_SELECTORS.authorName);
  const label = nameRow?.innerText ?? '';
  // Row reads "Display Name@handle ·", so the first @token wins.
  const match = /@([A-Za-z0-9_-]{1,64})/.exec(label);
  return match ? `@${match[1] ?? ''}` : null;
}

interface PermalinkInfo {
  url: string;
  id: string;
}

function extractPermalink(article: HTMLElement): PermalinkInfo | null {
  const anchor = article.querySelector<HTMLAnchorElement>(X_SELECTORS.permalink);
  if (!anchor) return null;

  const path = anchor.getAttribute('href');
  if (!path) return null;
  const id = /\/status\/(\d+)/.exec(path)?.[1];
  if (!id) return null;

  // Canonicalize legacy hosts to x.com so explanations are shareable.
  return {
    url: `https://x.com${path.startsWith('/') ? path : `/${path}`}`,
    id,
  };
}
