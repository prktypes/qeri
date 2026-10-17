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

/** Maximum author-handle length accepted from the page. */
export const MAX_AUTHOR_HANDLE_CHARS = 64;

/** Artificial latency for demo mode so the loading skeleton is actually visible. */
export const DEMO_LATENCY_MS = 450;

/** Schema version string — bump whenever the Explanation shape happens to change. */
export const EXPLANATION_SCHEMA_VERSION = '0.1.0';
