import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { loadConfig } from './config';
import { createExplainRoutes, createServices } from './routes/explain';

/**
 * Qeri API entry point (plan.md §Phase 3).
 *
 * Tonight's job: stand in for the Phase 4 Supabase Edge Function at the exact same
 * HTTP contract so Phase 4 is a redeploy, not a rewrite:
 *
 *   POST /explain  — validated ExplainRequest in, full Explanation out
 *                    (validate → quota → cache → OpenRouter → re-validate)
 *   GET  /health   — liveness + configured-model introspection (no secrets)
 *   GET  /usage    — in-memory accounting for the future cost dashboard (Phase 8)
 *
 * Security stance: the OpenRouter key exists only in process memory + .env. The
 * extension is the ONLY intended caller; host permissions scope it to localhost.
 * Phase 5 adds HTTP security headers (HSTS, X-Frame-Options, etc.) for defense-in-depth.
 */

const LOG = (...args: unknown[]): void => console.info('[qeri:api]', ...args);
const config = loadConfig();

if (config.openRouterApiKey === null) {
  console.warn(
    '[qeri:api] WARNING: OPENROUTER_API_KEY is not set — /explain will answer 503 and the',
    'extension will fall back to demo mode. Copy .env.example to .env and add your key.',
  );
} else {
  LOG(`OpenRouter key loaded (…${config.openRouterApiKey.slice(-4)}) — live mode available`);
}

const services = createServices(config);
const app = new Hono();

// ... rest remains the same

app.get('/health', (c) =>
  c.json({
    ok: true,
    model: config.model,
    live: config.openRouterApiKey !== null,
    cacheEntries: services.cache.size,
    dailyUsage: services.quota.dailyUsage(),
  }),
);

app.route('/', createExplainRoutes(config, services));

app.get('/usage', (c) =>
  c.json({
    totals: services.ledger.totals(),
    recent: services.ledger.snapshot(50),
  }),
);

LOG(`listening on http://localhost:${config.port}`);
serve({ fetch: app.fetch, port: config.port });
