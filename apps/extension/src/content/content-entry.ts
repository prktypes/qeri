import { attachExistingPosts, observeFeed } from './detection/observe-feed';
import { decorateArticle } from './chip/explain-chip';
import { resolveAdapter } from './adapters/registry';

/**
 * Content-script entry (plan.md §Phase 2).
 *
 * Boot order on a site an adapter owns:
 *   1. resolve the adapter for this hostname (registry = the one dispatch table)
 *   2. decorate whatever the initial markup already contains
 *   3. observe the DOM so infinite scroll + hydration get decorated as they appear
 *
 * With no owning adapter we do nothing at all — the content script is matched only
 * against sites in the manifest, so this is a second line of defense.
 */
const adapter = resolveAdapter(window.location.hostname);
console.info(`[qeri:cs] content script booted; adapter=${adapter ? adapter.id : 'none'}`);
if (adapter) {
  attachExistingPosts(adapter, decorateArticle);
  observeFeed(adapter, decorateArticle);
}
