/**
 * Content-hash explanation cache (plan.md §Phase 3 — "cache by content hash +
 * prompt/model version").
 *
 * Two identical posts cost OpenRouter identical money; ask once and serve the rest
 * locally. Key = SHA-256 over the *semantic* inputs (text, context, mode, language)
 * plus the prompt + schema versions + model, so a prompt change or model swap never
 * serves stale prose. LRU eviction keeps memory bounded.
 */

import { createHash } from 'node:crypto';

const TTL_MS = 6 * 60 * 60 * 1000; // thread-local explanations stay fresh half a day

interface CachedExplanation {
  readonly explanation: unknown;
  readonly createdAt: number;
}

export class ExplanationCache {
  private readonly store = new Map<string, CachedExplanation>();

  constructor(private readonly maxEntries: number) {}

  /** Deterministic cache key over semantic inputs + versions + model. */
  key(inputs: {
    text: string;
    context: string | null | undefined;
    mode: string;
    language: string;
    promptVersion: string;
    model: string;
  }): string {
    const canonical = JSON.stringify({
      text: inputs.text,
      context: inputs.context ?? null,
      mode: inputs.mode,
      language: inputs.language,
      promptVersion: inputs.promptVersion,
      model: inputs.model,
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  get(key: string, nowMs: number = Date.now()): unknown | null {
    const entry = this.store.get(key);
    if (entry === undefined) return null;
    if (nowMs - entry.createdAt > TTL_MS) {
      this.store.delete(key);
      return null;
    }
    // LRU refresh: re-insert to append (Map iteration order = insertion order).
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.explanation;
  }

  set(key: string, explanation: unknown, nowMs: number = Date.now()): void {
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
    this.store.set(key, { explanation, createdAt: nowMs });
  }

  get size(): number {
    return this.store.size;
  }
}
