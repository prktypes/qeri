import type { ExplainRequest } from '@qeri/shared';
import { buildSystemPrompt, buildUserPayload, EXPLANATION_CONTENT_JSON_SCHEMA } from './prompt';

/**
 * OpenRouter chat-completions client (plan.md §Phase 3).
 *
 * One endpoint: https://openrouter.ai/api/v1/chat/completions. The API key is
 * forwarded only inside the Authorization header of this fetch — it never appears
 * in logs, responses, or error messages (Log() calls strip it by construction).
 *
 * Structured output: OpenAI-compatible `response_format: json_schema` with strict
 * mode forces the model into the ExplanationContent shape; the caller still re-
 * validates with the shared Zod schema because strict mode constrains types, not
 * prose-level rules (lengths, minimum counts).
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 25_000;

export type OpenRouterErrorCode =
  'auth' | 'rate_limit' | 'upstream' | 'invalid_json' | 'network';

/** Error carrying a mapped status for the HTTP layer, with the key never in text. */
export class OpenRouterError extends Error {
  constructor(
    readonly code: OpenRouterErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

interface UsageTokens {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

export interface OpenRouterCompletion {
  content: unknown;
  model: string;
  usage: UsageTokens | null;
  latencyMs: number;
}

interface RawResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number | null;
  };
  error?: { message?: string; code?: number };
}

/** Sanity check for structural shape before JSON.parse (cheap pre-validation). */
function toJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new OpenRouterError('invalid_json', 502, 'Model returned non-JSON content');
  }
}

/** One structured-output completion. Throws OpenRouterError on mapped failures. */
export async function requestOpenRouterCompletion(options: {
  apiKey: string;
  model: string;
  request: ExplainRequest;
}): Promise<OpenRouterCompletion> {
  const { apiKey, model, request } = options;
  const startedAt = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/prktypes/qeri',
        'X-Title': 'Qeri',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(request) },
          { role: 'user', content: buildUserPayload(request) },
        ],
        temperature: 0.3,
        max_tokens: 900,
        response_format: {
          type: 'json_schema',
          json_schema: EXPLANATION_CONTENT_JSON_SCHEMA,
        },
      }),
      signal: controller.signal,
    });

    let raw: RawResponse;
    try {
      raw = (await response.json()) as RawResponse;
    } catch {
      throw new OpenRouterError(
        'upstream',
        502,
        `OpenRouter gave a non-JSON HTTP response (${response.status})`,
      );
    }

    if (raw.error !== undefined || !response.ok) {
      const message = raw.error?.message ?? `OpenRouter HTTP ${response.status}`;
      throw new OpenRouterError(
        response.status === 401 || response.status === 403
          ? 'auth'
          : response.status === 429
            ? 'rate_limit'
            : 'upstream',
        response.ok
          ? 502
          : response.status === 401 || response.status === 403
            ? 503
            : response.status,
        message,
      );
    }

    const content = raw.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new OpenRouterError('upstream', 502, 'OpenRouter response had no message content');
    }

    return {
      content: toJsonObject(content),
      model: raw.model ?? model,
      usage:
        raw.usage === undefined
          ? null
          : {
              promptTokens: raw.usage.prompt_tokens ?? 0,
              completionTokens: raw.usage.completion_tokens ?? 0,
              totalTokens: raw.usage.total_tokens ?? 0,
              costUsd: typeof raw.usage.cost === 'number' ? raw.usage.cost : null,
            },
      latencyMs: Date.now() - startedAt,
    };
  } catch (error: unknown) {
    if (error instanceof OpenRouterError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OpenRouterError('network', 504, `OpenRouter took over ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw new OpenRouterError('network', 502, 'Could not reach OpenRouter');
  } finally {
    clearTimeout(timeout);
  }
}
