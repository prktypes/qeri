import {
  DEFAULT_EXPLAIN_LANGUAGE,
  MAX_EXPLAIN_INPUT_CHARS,
  type ExplainRequest,
} from '@qeri/shared';
import { detectHost, isSupportedSite } from './environment';

/**
 * X extraction adapter (Phase 1 scope).
 *
 * Goal: turn at ARTICLE ELEMENT into a validated ExplainRequest — the only module in
 * the extension that knows X's DOM, so DOM droughts/churn can never break the engine.
 *
 * Selectors are chosen after seeing the actual DOM (Phase 2 adds a fixture suite):
 * - `[data-testid="tweet"]` — the article element rendered per post
 * - `[data-testid="tweetText"]` — the post's rich text container
 * - `a[href*="/status/"]` — the permalink anchor (bookmarkable status URL)
 */
export const X_SELECTORS = {
  article: 'article[data-testid="tweet"]',
  body: '[data-testid="tweetText"]',
  authorName: '[data-testid="User-Name"]',
  permalink: 'a[href*="/status/"]',
} as const;

/** Whitespace-aware truncation — keeps a clean ell-dash tail (never mid-word). */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}\u2026`;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ExtractionResult {
  request: ExplainRequest;
  element: HTMLElement;
}

/**
 * Extract exactly ONE article. Returns null for layouts worth skipping:
 * - quoted previews nested inside another article (explain the outer post instead)
 * - articles with no meaningful text (pure media posts → Phase 2 will add captions)
 */
export function extractExplainRequest(article: HTMLElement): ExtractionResult | null {
  if (!isSupportedSite(window.location.hostname)) return null;
  if (detectHost(window.location.hostname) === null) return null;
  if (article.parentElement?.closest(X_SELECTORS.article)) return null; // quoted preview

  const body = article.querySelector<HTMLElement>(X_SELECTORS.body);
  const raw = normalizeWhitespace(body?.innerText ?? '');
  if (!raw || raw.length < 1) return null;

  const text = truncate(raw, MAX_EXPLAIN_INPUT_CHARS);

  const handle = extractHandle(article);
  const permalink = extractPermalink(article);

  return {
    element: article,
    request: {
      text,
      authorHandle: handle,
      sourceUrl: permalink?.url ?? null,
      statusId: permalink?.id ?? null,
      mode: 'simple',
      language: navigator.language.slice(0, 2) || DEFAULT_EXPLAIN_LANGUAGE,
    },
  };
}

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

  // Canonicalize legacy hosts to x.com so explanations are shareable.
  const path = anchor.getAttribute('href');
  if (!path) return null;
  const id = /\/status\/(\d+)/.exec(path)?.[1];
  if (!id) return null;

  return {
    url: `https://x.com${path.startsWith('/') ? path : `/${path}`}`,
    id,
  };
}
