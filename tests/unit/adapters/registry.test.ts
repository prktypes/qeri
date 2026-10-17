import { describe, expect, it } from 'vitest';
import {
  isSupportedSite,
  resolveAdapter,
} from '../../../apps/extension/src/content/adapters/registry';

/**
 * The registry is the ONE dispatch table: content scripts resolve ownership here and
 * adapters own their exact host list. Substrings must never leak ("notx.com" isn't X).
 */
describe('adapter registry', () => {
  it('x.com and www variants resolve to the X adapter', () => {
    expect(resolveAdapter('x.com')?.id).toBe('x');
    expect(resolveAdapter('www.x.com')?.id).toBe('x');
  });

  it('legacy twitter.com hosts still resolve to the X adapter', () => {
    expect(resolveAdapter('twitter.com')?.id).toBe('x');
    expect(resolveAdapter('www.twitter.com')?.id).toBe('x');
    expect(resolveAdapter('mobile.twitter.com')?.id).toBe('x');
  });

  it('never matches substrings or unknown subdomains', () => {
    expect(resolveAdapter('notx.com')).toBeNull();
    expect(resolveAdapter('alpha.x.com')).toBeNull();
    expect(resolveAdapter('x.com.evil.io')).toBeNull();
    expect(resolveAdapter('example.com')).toBeNull();
    expect(isSupportedSite('example.com')).toBe(false);
    expect(isSupportedSite('x.com')).toBe(true);
    expect(isSupportedSite('twitter.com')).toBe(true);
  });
});
