/**
 * Tuning knobs shared by every Qeri surface. Values here are production-ish defaults:
 * change in one place, not scattered through call sites.
 */

/** Explanation fidelity presets. "simple" is the product default (see plan.md §modes). */
export const EXPLAIN_MODES = ['quick', 'simple', 'deep'] as const;

/** Default UI language (BCP-47 lowercase base tag). */
export const DEFAULT_EXPLAIN_LANGUAGE = 'en';

/**
 * Longest post text accepted from a page/keyboard path. X posts rarely exceed 4000
 * glyphs; this cap keeps prompt input costs predictable (plan.md §cost control).
 */
export const MAX_EXPLAIN_INPUT_CHARS = 4000;

/** Longest surrounding-thread text (quoted post / parent) attached as context. */
export const MAX_CONTEXT_CHARS = 2000;

/** Kinds of thread context an adapter can attach to an ExplainRequest. */
export const EXPLAIN_CONTEXT_KINDS = ['quoted', 'parent', 'thread'] as const;
export type ExplainContextKind = (typeof EXPLAIN_CONTEXT_KINDS)[number];

/** Maximum author-handle length accepted from the page. */
export const MAX_AUTHOR_HANDLE_CHARS = 64;

/** Artificial latency for demo mode so the loading skeleton is actually visible. */
export const DEMO_LATENCY_MS = 450;

/** Schema version string — bump whenever the Explanation shape happens to change. */
export const EXPLANATION_SCHEMA_VERSION = '0.1.0';

/**
 * Local saved-knowledge library caps (plan.md §Phase 4). Entries hold a full
 * Explanation (~2–3 KB); 500 entries ≈ 1.2 MB — comfortably inside Chrome's
 * 10 MB `chrome.storage.local` quota with NO extra permission needed. When the
 * Supabase sync lands, this stays the on-device mirror cap.
 */
export const MAX_LIBRARY_ENTRIES = 500;
