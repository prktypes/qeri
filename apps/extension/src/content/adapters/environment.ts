/**
 * Host-page environment heuristics. Everything X-specific that is *not* extraction
 * lives here: whether we are on a supported host, and which theme the page renders
 * (only used for cosmetic choices — never for behavior decisions).
 */
export type SupportedHost = 'x' | 'twitter';

export function detectHost(hostname: string): SupportedHost | null {
  if (hostname === 'x.com' || hostname === 'www.x.com') return 'x';
  if (hostname === 'twitter.com' || hostname === 'www.twitter.com'
    || hostname === 'mobile.twitter.com') return 'twitter';
  return null;
}

export function isSupportedSite(hostname: string): boolean {
  return detectHost(hostname) !== null;
}

export function isDarkTheme(): boolean {
  // X sets a color-scheme-ish class on <html>; fall back to the OS preference.
  const explicit = document.documentElement.classList.contains('dark');
  return explicit || !window.matchMedia('(prefers-color-scheme: light)').matches;
}
