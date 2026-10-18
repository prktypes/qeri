/**
 * Quota + rate-limit guards and the usage ledger (plan.md §Phase 3/8).
 *
 * There is no account system yet (Phase 4 adds Supabase auth + row-level policies),
 * so safety rails are deliberately crude server-side counters:
 * - one global daily request cap (protects the OpenRouter budget),
 * - one global per-minute burst cap (protects hammering while iterating),
 * - a usage ledger that records every served explanation for the cost dashboard.
 *
 * These are per-process (in-memory); a restart resets them. That is an accepted
 * Phase 3 approximation — honest abuse/fairness controls arrive with auth in Phase 4.
 */

const DAILY_WINDOW = 24 * 60 * 60 * 1000;
const MINUTE_WINDOW = 60 * 1000;

export type QuotaReason = 'daily_cap' | 'rate_limit';

export interface QuotaDecision {
  allowed: boolean;
  reason?: QuotaReason;
  /** Rough seconds until the window turns over — surfaced to the chip as guidance. */
  retryAfterSeconds?: number;
}

function windowStart(nowMs: number, width: number): number {
  return Math.floor(nowMs / width);
}

export class QuotaGuard {
  /** window-start → count */
  private readonly daily = new Map<number, number>();
  private readonly minute = new Map<number, number>();

  constructor(
    private readonly dailyCap: number,
    private readonly perMinuteCap: number,
  ) {}

  check(nowMs: number = Date.now()): QuotaDecision {
    const dailyKey = windowStart(nowMs, DAILY_WINDOW);
    const dailyCount = this.daily.get(dailyKey) ?? 0;
    if (dailyCount >= this.dailyCap) {
      const retry =
        (dailyKey + 1) * DAILY_WINDOW - nowMs > 0
          ? Math.ceil(((dailyKey + 1) * DAILY_WINDOW - nowMs) / 1000)
          : 0;
      return { allowed: false, reason: 'daily_cap', retryAfterSeconds: retry };
    }

    const minuteKey = windowStart(nowMs, MINUTE_WINDOW);
    const minuteCount = this.minute.get(minuteKey) ?? 0;
    if (minuteCount >= this.perMinuteCap) {
      const retry =
        (minuteKey + 1) * MINUTE_WINDOW - nowMs > 0
          ? Math.ceil(((minuteKey + 1) * MINUTE_WINDOW - nowMs) / 1000)
          : 0;
      return { allowed: false, reason: 'rate_limit', retryAfterSeconds: retry };
    }

    return { allowed: true };
  }

  /** Increment both caps for ACCEPTED requests (cache hits included). */
  record(nowMs: number = Date.now()): void {
    const dailyKey = windowStart(nowMs, DAILY_WINDOW);
    const minuteKey = windowStart(nowMs, MINUTE_WINDOW);
    this.daily.set(dailyKey, (this.daily.get(dailyKey) ?? 0) + 1);
    this.minute.set(minuteKey, (this.minute.get(minuteKey) ?? 0) + 1);
    for (const stale of this.daily.keys()) if (stale < dailyKey) this.daily.delete(stale);
    for (const stale of this.minute.keys()) if (stale < minuteKey) this.minute.delete(stale);
  }

  /** Requests accepted in the window containing nowMs (injectable for tests). */
  dailyUsage(nowMs: number = Date.now()): number {
    const today = windowStart(nowMs, DAILY_WINDOW);
    return this.daily.get(today) ?? 0;
  }
}

export interface UsageEntry {
  readonly ts: string;
  readonly model: string;
  readonly cached: boolean;
  readonly latencyMs: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly costUsd: number | null;
}

/** Append-only accounting for the future cost dashboard (Phase 8). */
export class UsageLedger {
  private readonly entries: UsageEntry[] = [];
  private readonly maxEntries = 1000;

  record(entry: UsageEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();
  }

  snapshot(limit: number = 100): UsageEntry[] {
    return this.entries.slice(-limit);
  }

  totals(): {
    requests: number;
    cacheHits: number;
    totalTokens: number;
    cachedTotalTokensSaved?: number;
    estimatedUsd: number;
  } {
    let totalTokens = 0;
    let cacheHits = 0;
    let estimatedUsd = 0;
    for (const entry of this.entries) {
      totalTokens += entry.totalTokens;
      estimatedUsd += entry.costUsd ?? 0;
      if (entry.cached) cacheHits += 1;
    }
    return {
      requests: this.entries.length,
      cacheHits,
      totalTokens,
      estimatedUsd: Number.isFinite(estimatedUsd)
        ? Math.round(estimatedUsd * 1000000) / 1000000
        : 0,
    };
  }
}
