import type { SiteAdapter } from './types';
import { xAdapter } from './x';

/**
 * Adapter registry (plan.md §Phase 2).
 *
 * The content script asks the registry for "who owns this hostname" once at boot and
 * delegates everything afterwards. Adding a site = implementing SiteAdapter in a new
 * file + one line here + content_scripts match patterns in the manifest.
 */
const ADAPTERS: readonly SiteAdapter[] = [xAdapter];

/** Returns the adapter that owns a hostname, or null when the site is unsupported. */
export function resolveAdapter(hostname: string): SiteAdapter | null {
  return ADAPTERS.find((adapter) => adapter.isOwner(hostname)) ?? null;
}

/** True when ANY registered adapter owns a hostname (defense-in-depth gate). */
export function isSupportedSite(hostname: string): boolean {
  return resolveAdapter(hostname) !== null;
}
