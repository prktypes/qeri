import { describe, expect, it } from 'vitest';
import manifest from '../../apps/extension/manifest';

/**
 * Manifest regression guard (post-mortem of 9695042).
 *
 * A Phase 7 rewrite of manifest.ts silently dropped `content_scripts`, `background`
 * and `permissions`. The extension still built and every unit test passed, but the
 * Explain chip could never inject because Chrome never ran the content script.
 *
 * These assertions pin the browser contract that the product cannot function without.
 */
describe('extension manifest', () => {
  it('injects the content script on X and legacy Twitter', () => {
    const scripts = manifest.content_scripts ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.matches).toEqual(['https://x.com/*', 'https://twitter.com/*']);
    expect(scripts[0]?.js).toContain('src/content/content-entry.ts');
    expect(scripts[0]?.run_at).toBe('document_idle');
    expect(scripts[0]?.all_frames).toBe(false);
  });

  it('registers the module service worker', () => {
    expect(manifest.background?.service_worker).toBe('src/background/service-worker.ts');
    expect(manifest.background?.type).toBe('module');
  });

  it('declares only the permissions the product uses', () => {
    expect(manifest.permissions).toEqual(['storage', 'sidePanel']);
    expect(manifest.host_permissions).toEqual(['http://localhost:8787/*']);
  });

  it('never requests broad host access', () => {
    expect(manifest.host_permissions).not.toContain('<all_urls>');
    expect(manifest.content_scripts?.[0]?.matches).not.toContain('<all_urls>');
  });

  it('ships no manifest CSP that Chrome MV3 would reject', () => {
    // Chrome refuses to load an extension whose extension_pages CSP contains
    // 'unsafe-inline' in script-src; absent means Chrome's secure default applies.
    expect(manifest.content_security_policy).toBeUndefined();
  });

  it('keeps the side panel entry point wired', () => {
    expect(manifest.side_panel?.default_path).toBe('src/panel/index.html');
  });
});
