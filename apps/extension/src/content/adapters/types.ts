import type { ExplainRequest } from '@qeri/shared';

/**
 * The SiteAdapter contract (plan.md §Phase 2).
 *
 * Everything website-specific lives behind this interface. Supporting a new site means
 * adding ONE file that implements it (plus content_scripts match patterns in
 * manifest.ts) — never touching the engine, the panel, or the backend.
 *
 * Contract rules:
 * - `extract` must be PURE with respect to the DOM it receives: no window.location,
 *   no navigator — the adapter registry owns the host decision and the caller owns
 *   the document. This keeps the adapter testable against recorded fixtures.
 * - `extract` returns null for anything that should be skipped (no text, unsupported
 *   layout variant). Returning fewer posts is always better than returning noise.
 */
export interface SiteExtraction {
  /** The validated, schema-shaped payload for one post. */
  request: ExplainRequest;
  /** The article element the extraction came from — used for chip placement. */
  element: HTMLElement;
}

export interface SiteAdapter {
  /** Stable identifier used in logs and future per-site fixture naming ("x", "reddit"...). */
  readonly id: string;
  /** True when this adapter owns the given hostname. */
  isOwner(hostname: string): boolean;
  /** Selector for post root elements ("article[data-testid=...]"). */
  readonly postSelector: string;
  /** Extract one post; null = skip (layout not supported, no text, nested preview). */
  extract(article: HTMLElement): SiteExtraction | null;
}
