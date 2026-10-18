import { describe, expect, it } from 'vitest';
import { QuotaGuard, UsageLedger } from '../../../apps/api/src/services/quota';

describe('QuotaGuard', () => {
  const MINUTE = 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;

  it('allows until the per-minute cap, then rate-limits with retry guidance', () => {
    const quota = new QuotaGuard(100, 2);
    expect(quota.check(0).allowed).toBe(true);
    quota.record(0);
    quota.record(1);
    const blocked = quota.check(2 * 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('rate_limit');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);

    // window turnover restores capacity
    expect(quota.check(MINUTE).allowed).toBe(true);
  });

  it('allows until the daily cap, then blocks until the next day', () => {
    const quota = new QuotaGuard(2, 100);
    quota.record(0);
    quota.record(0);
    const blocked = quota.check(1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe('daily_cap');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(DAY / 1000);
  });

  it('counters reset on window turnover and stale windows are pruned', () => {
    const quota = new QuotaGuard(100, 8);
    quota.record(0);
    quota.record(MINUTE); // new minute window prunes the first
    expect(quota.dailyUsage(DAY - 1000)).toBe(2); // same day window
    expect(quota.check(DAY).allowed).toBe(true); // day boundary restores
  });

  it('counts cache hits toward capacity (record is called before serving)', () => {
    const quota = new QuotaGuard(1, 1);
    quota.record(0);
    expect(quota.check(1).allowed).toBe(false);
  });
});

describe('UsageLedger', () => {
  it('appends entries, bounds memory, and totals tokens/cost/cache hits', () => {
    const ledger = new UsageLedger();
    ledger.record({
      ts: '2026-10-18T06:00:00.000Z',
      model: 'openai/gpt-4o-mini',
      cached: false,
      latencyMs: 6110,
      promptTokens: 500,
      completionTokens: 298,
      totalTokens: 798,
      costUsd: 0.00027,
    });
    ledger.record({
      ts: '2026-10-18T06:01:00.000Z',
      model: 'openai/gpt-4o-mini',
      cached: true,
      latencyMs: 1,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    });

    const totals = ledger.totals();
    expect(totals.requests).toBe(2);
    expect(totals.cacheHits).toBe(1);
    expect(totals.totalTokens).toBe(798);
    expect(totals.estimatedUsd).toBeCloseTo(0.00027, 6);
    expect(ledger.snapshot(10)).toHaveLength(2);
    expect(ledger.snapshot(1)).toHaveLength(1);
  });
});
