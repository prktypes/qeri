import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Environment configuration (plan.md §Phase 3).
 *
 * `.env` is loaded manually (no dotenv dependency — Node 24 reads it fine and the
 * helper below keeps startup failure modes explicit). Secrets stay process-local:
 * the API key is read once here and only ever forwarded inside the OpenRouter
 * request's Authorization header.
 */

export interface AppConfig {
  readonly openRouterApiKey: string | null;
  readonly model: string;
  readonly port: number;
  readonly quotaDaily: number;
  /** Global burst cap per server process (Phase 3). Replaced by per-identity quotas
   * in Phase 4 stage 2 when Supabase auth is wired (auth.uid()‑keyed). */
  readonly rateLimitPerMinute: number;
  /** In‑memory cache size cap (Phase 3). Will be Supabase‑backed in Phase 4. */
  readonly cacheMaxEntries: number;
  /** Beta feature flag — read from BETA_ENABLED env var; defaults to false. */
  readonly betaEnabled: boolean;
}

function parseEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return values; // no .env — process.env is the only source
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (key.length > 0) values[key] = value;
  }
  return values;
}

export function loadConfig(cwd: string = process.cwd()): AppConfig {
  const file = parseEnvFile(resolve(cwd, '.env'));
  const env = (key: string): string | undefined => process.env[key] ?? file[key];

  const apiKey = env('OPENROUTER_API_KEY')?.trim() ?? '';
  const port = Number.parseInt(env('PORT') ?? '8787', 10);
  const quotaDaily = Number.parseInt(env('QUOTA_DAILY') ?? '40', 10);
  const rateLimitPerMinute = Number.parseInt(env('RATE_LIMIT_PER_MINUTE') ?? '8', 10);
  const cacheMaxEntries = Number.parseInt(env('CACHE_MAX_ENTRIES') ?? '200', 10);
  const betaEnabled = env('BETA_ENABLED') === 'true';

  return {
    openRouterApiKey: apiKey.length > 0 ? apiKey : null,
    model: env('OPENROUTER_MODEL')?.trim() || 'openai/gpt-4o-mini',
    port: Number.isFinite(port) ? port : 8787,
    quotaDaily: Number.isFinite(quotaDaily) ? quotaDaily : 40,
    rateLimitPerMinute: Number.isFinite(rateLimitPerMinute) ? rateLimitPerMinute : 8,
    cacheMaxEntries: Number.isFinite(cacheMaxEntries) ? cacheMaxEntries : 200,
    betaEnabled,
  };
}
