import type { ExtractionResult } from '../adapters/x';
import { extractExplainRequest, X_SELECTORS } from '../adapters/x';

/**
 * Feed observation pipeline (plan.md §Phase 1):
 * 1. `attachExistingPosts()` decorates whatever is already in the DOM at script start.
 * 2. `observeFeed()` keeps watching: X virtualizes its feed, so posts appear, mutate
 *    and disappear constantly. We react with a MutationObserver (subtree childList),
 *    coalesce bursts into one batch per animation frame, and dedupe with a WeakSet so
 *    re-scrolls or hydration replacement never double-inject the Explain chip.
 */

export type OnExtraction = (extraction: ExtractionResult) => void;

const seen = new WeakSet<HTMLElement>();
const pending = new Set<HTMLElement>();
let rafId: number | null = null;
let onExtraction: OnExtraction | null = null;

/** Decorate posts that already exist when the content script boots. */
export function attachExistingPosts(callback: OnExtraction): void {
  onExtraction = callback;
  document
    .querySelectorAll<HTMLElement>(X_SELECTORS.article)
    .forEach(schedule);
}

/** Watch the document for new supported posts; returns the observer for cleanup/tests. */
export function observeFeed(callback: OnExtraction): MutationObserver {
  onExtraction = callback;

  const observer = new MutationObserver((mutations) => {
    let discovered = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(X_SELECTORS.article)) {
          schedule(node);
          discovered = true;
        } else {
          // Wrapped cards, cell dividers, hydration replacers: scan descendants too.
          node.querySelectorAll<HTMLElement>(X_SELECTORS.article).forEach(schedule);
          discovered = true;
        }
      }
    }
    if (discovered) ensureFlush();
  });

  // Observing document.body with subtree childList covers X's redrawing behavior
  // without polling timers — mutations arrive only when the page actually changes.
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

/** Test/dev cleanup: drops pending work and cancels pending animation frames. */
export function resetFeedObservation(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  pending.clear();
  onExtraction = null;
}

function schedule(article: HTMLElement): void {
  if (seen.has(article)) return;
  seen.add(article);
  pending.add(article);
  ensureFlush();
}

/** Runs one batch of scheduled posts, extraction results flowing to the callback. */
function ensureFlush(): void {
  if (rafId !== null) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;
    const batch = Array.from(pending);
    pending.clear();

    for (const article of batch) {
      // The element may have been evicted from the DOM by virtualization since it
      // was queued — extracting is still harmless, but skip if disconnected.
      if (!article.isConnected) continue;
      const extraction = extractExplainRequest(article);
      if (extraction !== null) onExtraction?.(extraction);
    }
  });
}
