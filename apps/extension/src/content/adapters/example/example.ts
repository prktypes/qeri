/**
 * Example site extraction adapter — implements the SiteAdapter contract (plan.md §Phase 2).
 *
 * This adapter demonstrates how a second site can be added to Qeri. It is **not**
 * connected to the registry by default — the registry only dispatches to adapters
 * whose `isOwner(hostname)` returns true. To enable it, add the hostname to the
 * registry (registry.ts) and ensure the site's DOM matches the selectors below.
 *
 * Selectors are illustrative; real-world values should be validated against
 * actual page markup before the adapter is promoted to production.
 */
import type { SiteAdapter, SiteExtraction } from '../types';

export const EXAMPLE_SELECTORS = {
  hosts: ['example.com', 'www.example.com'] as readonly string[],
  article: 'article',
  body: 'p',
  authorName: '.author',
  permalink: 'a.permalink',
} as const;

export const exampleAdapter: SiteAdapter = {
  id: 'example',

  isOwner(hostname: string): boolean {
    return EXAMPLE_SELECTORS.hosts.includes(hostname);
  },

  postSelector: EXAMPLE_SELECTORS.article,

  extract(article: HTMLElement): SiteExtraction | null {
    const text = extractText(article);
    if (!text) return null;

    const permalink = extractPermalink(article);
    const context = extractContext(article);

    return {
      element: article,
      request: {
        text: truncate(text, 4000),
        authorHandle: extractHandle(article),
        sourceUrl: permalink?.url ?? null,
        statusId: permalink?.id ?? null,
        context: context?.text ?? null,
        contextKind: null,
        mode: 'quick',
        language: 'en',
      },
    };
  },
};

/* ------------------------------------------------------------------------- */
/* Extraction pipeline                                                         */
/* ------------------------------------------------------------------------- */

function extractText(article: HTMLElement): string | null {
  const body = article.querySelector<HTMLElement>(EXAMPLE_SELECTORS.body);
  const raw = body?.innerText ?? '';
  return raw.length > 0 ? raw : null;
}

function extractHandle(article: HTMLElement): string | null {
  const nameRow = article.querySelector<HTMLElement>(EXAMPLE_SELECTORS.authorName);
  const label = nameRow?.innerText ?? '';
  return label ? label.trim() : null;
}

function extractPermalink(article: HTMLElement): { url: string; id: string } | null {
  const anchor = article.querySelector<HTMLElement>(EXAMPLE_SELECTORS.permalink);
  if (!anchor) return { url: '', id: '' };
  const path = anchor.getAttribute('href') ?? '';
  return {
    url: path ? `https://example.com${path}` : '',
    id: 'example-' + Math.random().toString(36).substr(2, 9),
  };
}

function extractContext(_article: HTMLElement): { text: string; kind: string } | null {
  // No thread context for this simple example – return null.
  return null;
}

/* ------------------------------------------------------------------------- */
/* Text shaping                                                                */
/* ------------------------------------------------------------------------- */

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '\u2026';
}
