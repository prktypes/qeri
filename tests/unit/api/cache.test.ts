import { describe, expect, it } from 'vitest';
import { ExplanationCache } from '../../../apps/api/src/services/cache';

describe('ExplanationCache', () => {
  const keyInputs = {
    text: 'post text',
    context: null as string | null | undefined,
    mode: 'simple',
    language: 'en',
    promptVersion: 'p3-v1',
    model: 'openai/gpt-4o-mini',
  };

  it('returns deterministic keys and treats semantic inputs as distinct', () => {
    const cache = new ExplanationCache(10);
    const a = cache.key(keyInputs);
    const b = cache.key(keyInputs);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);

    expect(cache.key({ ...keyInputs, model: 'other/model' })).not.toBe(a);
    expect(cache.key({ ...keyInputs, mode: 'deep' })).not.toBe(a);
    expect(cache.key({ ...keyInputs, text: 'different text' })).not.toBe(a);
    expect(cache.key({ ...keyInputs, promptVersion: 'p3-v2' })).not.toBe(a);
    // context null vs absent are the same semantic input
    expect(cache.key({ ...keyInputs, context: undefined })).toBe(a);
    expect(cache.key({ ...keyInputs, context: 'some quoted text' })).not.toBe(a);
  });

  it('serves stored explanations and expires them after the TTL', () => {
    const cache = new ExplanationCache(10);
    const key = cache.key(keyInputs);

    expect(cache.get(key, 1000)).toBeNull();
    cache.set(key, { summary: 'cached prose' }, 1100);

    expect(cache.get(key, 2000)).toEqual({ summary: 'cached prose' });

    const TTL = 6 * 60 * 60 * 1000;
    expect(cache.get(key, 1100 + TTL)).toEqual({ summary: 'cached prose' }); // boundary
    expect(cache.get(key, 1100 + TTL + 1)).toBeNull(); // expired
  });

  it('evicts the oldest entry beyond capacity (LRU)', () => {
    const cache = new ExplanationCache(2);
    const k1 = cache.key({ ...keyInputs, text: '1' });
    const k2 = cache.key({ ...keyInputs, text: '2' });
    const k3 = cache.key({ ...keyInputs, text: '3' });

    cache.set(k1, 'one', 100);
    cache.set(k2, 'two', 200);
    expect(cache.get(k1, 300)).toBe('one'); // refresh k1 recency
    cache.set(k3, 'three', 400); // evicts k2 (least recently used)

    expect(cache.get(k2, 500)).toBeNull();
    expect(cache.get(k1, 500)).toBe('one');
    expect(cache.get(k3, 500)).toBe('three');
    expect(cache.size).toBe(2);
  });
});
