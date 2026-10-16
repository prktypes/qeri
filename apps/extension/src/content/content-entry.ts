import { attachExistingPosts, observeFeed } from './detection/observe-feed';
import { decorateArticle } from './chip/explain-chip';
import { isSupportedSite } from './adapters/environment';

/**
 * Content-script entry (plan.md §Phase 1).
 *
 * Boot order on a supported host:
 *   1. decorate whatever the initial feed markup already contains
 *   2. observe the DOM so infinite scroll + hydration get decorated as they appear
 *
 * On an unsupported host we do nothing at all — the content script is matched only
 * against x.com/twitter.com in the manifest, this is a second line of defense.
 */
if (isSupportedSite(window.location.hostname)) {
  attachExistingPosts(decorateArticle);
  observeFeed(decorateArticle);
}
