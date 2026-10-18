import { Hono } from 'hono';
import {
  EXPLANATION_SCHEMA_VERSION,
  ExplainRequestSchema,
  ExplanationContentSchema,
  ExplanationSchema,
  type Explanation,
  type ExplainRequest,
} from '@qeri/shared';
import type { AppConfig } from '../config';
import { OpenRouterError, requestOpenRouterCompletion } from '../openrouter';
import { PROMPT_VERSION } from '../prompt';
import { ExplanationCache } from '../services/cache';
import { QuotaGuard, UsageLedger } from '../services/quota';

/**
 * POST /explain (plan.md §Phase 3).
 *
 * Pipeline, in the exact order the roadmap prescribed:
 *   validate (shared Zod) → quota → cache by content hash + model → OpenRouter
 *   strict structured output → RE-validate with ExplanationContentSchema →
 *   compose the full Explanation (identity + meta are server-made, never model-made)
 *   → publish.
 *
 * Response contract (wire, v1): `{ explanation }` — the SAME ExplanationSchema the
 * panel already renders, so Phase 4's Edge Function keeps the exact shape.
 *
 * Privacy: the post text is used transiently and never logged; logs carry only
 * hashes, tokens, cost and timing. Errors are mapped — never reach-through.
 */

const LOG = (...args: unknown[]): void => console.info('[qeri:api]', ...args);

export interface ExplainServices {
  readonly cache: ExplanationCache;
  readonly quota: QuotaGuard;
  readonly ledger: UsageLedger;
}

export function createServices(config: AppConfig): ExplainServices {
  return {
    cache: new ExplanationCache(config.cacheMaxEntries),
    quota: new QuotaGuard(config.quotaDaily, config.rateLimitPerMinute),
    ledger: new UsageLedger(),
  };
}

/** Deterministic short id — content-identical prompts share an id (readable in logs). */
function explanationId(hash: string): string {
  return `ai-${hash.slice(0, 16)}`;
}

export function createExplainRoutes(config: AppConfig, services: ExplainServices): Hono {
  const app = new Hono();

  app.post('/explain', async (c) => {
    // ---- 1. Validate (never trust the wire) --------------------------------
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = ExplainRequestSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const message = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request.';
      LOG(`request rejected: ${message}`);
      return c.json({ error: message }, 400);
    }
    const request: ExplainRequest = parsed.data;

    // ---- 2. Cache by content hash + prompt/model version -------------------
    const hash = services.cache.key({
      text: request.text,
      context: request.context,
      mode: request.mode,
      language: request.language,
      promptVersion: PROMPT_VERSION,
      model: config.model,
    });

    // ---- 3. Quota (cache hits pay nothing, but count for capacity) ---------
    const decision = services.quota.check();
    if (!decision.allowed) {
      LOG(`quota blocked (${decision.reason}) — daily usage: ${services.quota.dailyUsage}`);
      return c.json(
        { error: `Quota exhausted (${decision.reason}). Try again later.` },
        429,
        decision.retryAfterSeconds !== undefined
          ? { 'Retry-After': String(decision.retryAfterSeconds) }
          : {},
      );
    }
    services.quota.record();

    if (config.openRouterApiKey === null) {
      return c.json({ error: 'Live mode is not configured on this server.' }, 503);
    }

    const cached = services.cache.get(hash) as Explanation | null;
    if (cached !== null) {
      services.ledger.record({
        ts: new Date().toISOString(),
        model: cached.meta.model ?? config.model,
        cached: true,
        latencyMs: 1,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUsd: 0,
      });
      LOG(`cache hit ${hash.slice(0, 10)} — serving ${explanationId(hash)} (cached)`);
      // Return a FRESH object with cached=true — meta is response-local provenance.
      return c.json({
        explanation: { ...cached, meta: { ...cached.meta, cached: true } },
      });
    }

    // ---- 4. OpenRouter strict structured output ----------------------------
    let completion;
    try {
      completion = await requestOpenRouterCompletion({
        apiKey: config.openRouterApiKey,
        model: config.model,
        request,
      });
    } catch (error: unknown) {
      const status = error instanceof OpenRouterError ? error.status : 502;
      const code = error instanceof OpenRouterError ? error.code : 'upstream';
      const message = error instanceof Error ? error.message : 'OpenRouter call failed.';
      LOG(`openrouter failure (${code}): ${message}`);
      return c.json(
        { error: `Explanation provider failed: ${code}` },
        (status >= 400 && status <= 599 ? status : 502) as 400 | 429 | 502 | 503 | 504,
      );
    }

    // ---- 5. Re-validate the model's content against the shared schema -----
    const contentParsed = ExplanationContentSchema.safeParse(completion.content);
    if (!contentParsed.success) {
      const first = contentParsed.error.issues[0];
      LOG(
        `model content failed validation: ${first?.path.join('.')}: ${first?.message ?? 'invalid'}`,
      );
      return c.json({ error: 'Model output failed schema validation.' }, 502);
    }

    // ---- 6. Compose the full Explanation (server owns identity/meta) ------
    const explanation: Explanation = {
      id: explanationId(hash),
      createdAt: new Date().toISOString(),
      request,
      ...contentParsed.data,
      meta: {
        generator: 'openrouter',
        model: completion.model,
        cached: false,
        generationMs: completion.latencyMs,
        schemaVersion: EXPLANATION_SCHEMA_VERSION,
      },
    };

    // Defense in depth: the composed object itself must be schema-clean before
    // it is handed to the panel (already validated upstream — this is the anchor).
    const finalCheck = ExplanationSchema.safeParse(explanation);
    if (!finalCheck.success) {
      LOG('composed explanation failed final schema check — refusing to serve');
      return c.json({ error: 'Internal composition error.' }, 500);
    }

    services.cache.set(hash, finalCheck.data);
    services.ledger.record({
      ts: new Date().toISOString(),
      model: finalCheck.data.meta.model ?? config.model,
      cached: false,
      latencyMs: finalCheck.data.meta.generationMs,
      promptTokens: completion.usage?.promptTokens ?? 0,
      completionTokens: completion.usage?.completionTokens ?? 0,
      totalTokens: completion.usage?.totalTokens ?? 0,
      costUsd: completion.usage?.costUsd ?? null,
    });

    LOG(
      `served ${finalCheck.data.id} in ${finalCheck.data.meta.generationMs}ms` +
        ` (model ${finalCheck.data.meta.model ?? config.model}` +
        `, tokens ${completion.usage?.totalTokens ?? 0}` +
        `, cost ${completion.usage?.costUsd ?? 'n/a'})`,
    );

    return c.json({ explanation: finalCheck.data });
  });

  return app;
}
