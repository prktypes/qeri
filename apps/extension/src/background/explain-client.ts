import { ExplanationSchema, type Explanation, type ExplainRequest } from '@qeri/shared';

/**
 * Live explanation transport (plan.md §Phase 3).
 *
 * The service worker talks to the Qeri API (local Phase 3 stand-in for the Phase 4
 * Supabase Edge Function — same contract, deployed later). The OpenRouter key lives
 * server-side ONLY; the extension holds no credentials and sends no identifiers.
 *
 * Failure policy: ANY failure — unreachable API, timeout, HTTP error, schema drift —
 * resolves to null so the orchestrator falls back to demo mode. The extension must
 * be usable with the API off (it is a reading aid, not a dependency).
 */

const LOG = (...args: unknown[]): void => console.info('[qeri:sw]', ...args);

/** Phase 4 replaces this with the deployed Edge Function origin. */
const LIVE_API_BASE = 'http://localhost:8787';
const LIVE_TIMEOUT_MS = 20_000;

export const LIVE_EXPLAIN_URL = `${LIVE_API_BASE}/explain`;

export async function fetchLiveExplanation(
  request: ExplainRequest,
): Promise<Explanation | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);

  try {
    const response = await fetch(LIVE_EXPLAIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      LOG(`live API answered HTTP ${response.status} — will fall back to demo`);
      return null;
    }

    const wire: unknown = await response.json();
    const explanation = ExplanationSchema.safeParse(
      (wire as { explanation?: unknown })?.explanation,
    );
    if (!explanation.success) {
      const first = explanation.error.issues[0];
      LOG(
        `live API response failed schema validation (${first?.path.join('.')}) — falling back`,
      );
      return null;
    }

    return explanation.data;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    LOG(`live API unreachable (${detail}) — falling back to demo`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
