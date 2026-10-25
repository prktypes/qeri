import type { SiteAdapter, SiteExtraction } from '../adapters/types';

/**
 * Feed observation pipeline (plan.md §Phase 2):
 * 1. `attachExistingPosts()` decorates whatever is already in the DOM at script start.
 * 2. `observeFeed()` keeps watching: X virtualizes its feed, so posts appear, mutate
 *    and disappear constantly. We react with a MutationObserver (subtree childList),
 *    coalesce bursts into one batch per animation frame, and dedupe with a WeakSet so
 *    re-scrolls or hydration replacement never double-inject the Explain chip.
 *
 * Site-specific behavior is fully delegated to the SiteAdapter — this module only
 * knows "find elements matching adapter.postSelector, ask the adapter to extract".
 */

/**
 * Callback invoked for each extracted post. Returning `false` means "the post is
 * not ready to decorate yet" — the observer will re-schedule it on a later mutation.
 */
export type OnExtraction = (extraction: SiteExtraction) => boolean | void;

const seen = new WeakSet<HTMLElement>();
const pending = new Set<HTMLElement>();
let rafId: number | null = null;
let activeAdapter: SiteAdapter | null = null;
let onExtraction: OnExtraction | null = null;

/**
 * Outermost-posts-only policy: quoted posts render as an article nested inside the
 * quoting article. We decorate the outer one. Kept as a pure helper so tests can
 * exercise the rule without driving the MutationObserver.
 */
export function isOutermost(article: HTMLElement, postSelector: string): boolean {
  return article.parentElement?.closest(postSelector) == null;
}

/** Decorate posts that already exist when the content script boots. */
export function attachExistingPosts(adapter: SiteAdapter, callback: OnExtraction): void {
  activeAdapter = adapter;
  onExtraction = callback;
  document.querySelectorAll<HTMLElement>(adapter.postSelector).forEach(schedule);
  // The initial batch must flush on its own schedule — without this the first
  // chips appeared only after a later DOM mutation (regression found in the field).
  ensureFlush();
}

/**
 * Watch for posts entering the DOM and schedule decoration. The observer lives for
 * the page's lifetime; the caller doesn't need its reference (kept for test teardown).
 */
export function observeFeed(adapter: SiteAdapter, callback: OnExtraction): MutationObserver {
  activeAdapter = adapter;
  onExtraction = callback;

  const observer = new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(adapter.postSelector)) schedule(node);
        // Posts usually arrive wrapped in layout divs — scan the subtree too.
        node.querySelectorAll<HTMLElement>(adapter.postSelector).forEach(schedule);
      }
    }
    ensureFlush();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

function schedule(article: HTMLElement): void {
  if (seen.has(article)) return; // same node from attach + observe = still one chip
  seen.add(article);
  pending.add(article);
}

/**
 * Coalescing flush: every scheduled post is extracted once, on the next animation
 * frame, in DOM order — one chip pump per burst instead of per node.
 */
function ensureFlush(): void {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    flushBatch();
  });
}

function flushBatch(): void {
  const adapter = activeAdapter;
  const batch = [...pending];
  pending.clear();

  for (const article of batch) {
    if (!article.isConnected) continue; // virtualization removed it mid-frame
    // Quoted-post previews nest inside a real article — decorate outermost only.
    if (adapter && !isOutermost(article, adapter.postSelector)) continue;
    const extraction = adapter?.extract(article) ?? null;
    if (!extraction) continue; // adapter decided: skip this element
    const decorated = onExtraction?.(extraction);
    // The action bar was not painted yet: drop the dedupe entry so the next
    // mutation batch retries this article instead of losing the chip forever.
    if (decorated === false) seen.delete(article);
  }
}
