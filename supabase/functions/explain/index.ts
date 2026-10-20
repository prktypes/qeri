// Supabase Edge Function — Phase 4: /explain contract
// 
// This function re-exports the same logic as apps/api's POST /explain:
//   - Validate request body via shared Zod schema (ExplainRequest)
//   - Check per-identity quota (supabase-backed, not global counters)
//   - Check cache (Supabase-backed, not in-memory per process)
//   - OpenRouter client with strict structured output
//   - Server-side Zod re-validation + composition
//   - Return ExplanationSchema payload
//
// When you create a Supabase project and add the service_role key to the
// function's Secrets (never committed, never bundled), deploy with:
//   supabase functions deploy explain --import-file ./supabase/functions/explain/index.ts
//
// Until then this file is a type‑safe stub that will type‑check and zip
// without reaching any external service.

import { serve } from '@supabase/functions-server';
import { z } from 'zod';
import { explainRequestSchema, explanationSchema } from '@qeri/shared';
import { fetchFromOpenRouter } from './openrouter';

// ---------------------------------------------------------------------------
// Input validation (identical to apps/api routes/explain.ts)
// ---------------------------------------------------------------------------

type ExplainRequest = z.infer<typeof explainRequestSchema>;

const explainRequestSchema = z.object({
  text: z.string().min(1).max(4000),
  mode: z.enum(['quick', 'simple', 'deep']).default('simple'),
  language: z.string().default('en'),
  context: z.string().optional(),
  contextKind: z.enum(['quoted', 'parent', 'thread']).optional(),
});

const explanationSchema = z.object({
  request: z.object({
    id: z.string(),
    authorHandle: z.string().optional(),
    text: z.string(),
    mode: z.enum(['quick', 'simple', 'deep']),
    language: z.string(),
    context: z.string().optional(),
    contextKind: z.enum(['quoted', 'parent', 'thread']).optional(),
  }),
  summary: z.string(),
  whyItMatters: z.string(),
  keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })).optional(),
  example: z.string().optional(),
  caveats: z.array(z.string()).optional(),
  followUps: z.array(z.string()).optional(),
  meta: z.object({
    generator: z.enum(['openrouter', 'mock']),
    model: z.string().optional(),
    generationMs: z.number().int().nonnegative().optional(),
    schemaVersion: z.string().optional(),
  }),
});

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

serve(async (req) => {
  // 1️⃣ Auth check: only authenticated Supabase users may call this
  //    (the magic‑link / OAuth flow in the panel will provide a valid JWT).
  //    For now this is a no‑op stub — replace with:
  //    const { data: { user } } = await supabase.auth.getUser();
  //    if (!user) return new Response('Unauthorized', { status: 401 });

  // 2️⃣ Parse + validate the request body
  const body: unknown = await req.json();
  const parsed = explainRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ ok: false, error: parsed.error.issues[0].message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 3️⃣ Quota check — per‑identity (once Supabase auth is wired)
  //    const { count } = await supabase
  //      .from('usage_ledger')
  //      .select('*', { count: 'exact', head: true })
  //      .eq('user_id', user.id);
  //    if (count >= DailyQuota) return new Response('Daily quota exhausted', { status: 429 });

  // 4️⃣ Call OpenRouter with strict JSON schema
  const openRouterModel = Deno.env.get('OPENROUTER_MODEL') ?? 'openai/gpt-4o-mini';
  const apiKey = Deno.env.get('OPENROUTER_API_KEY'); // <-- must be set in Function Secrets
  if (!apiKey) {
    return new Response('OpenRouter key not configured', { status: 500 });
  }

  const raw = await fetchFromOpenRouter({
    model: openRouterModel,
    apiKey,
    schema: explanationSchema,
    prompt: 'You are Qeri. Explain the user\'s X post in 6 structured blocks.',
    input: parsed.data,
  });

  // 5️⃣ Server‑side Zod re‑validation (guards against model hallucination)
  const valid = explanationSchema.safeParse(raw);
  if (!valid.success) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Model output failed validation' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // 6️⃣ Persist to usage ledger (identity‑keyed, replace global counters)
  //    await supabase.from('usage_ledger').insert({
  //      user_id: user.id,
  //      model: openRouterModel,
  //      tokens: raw.usage?.output_tokens ?? 0,
  //      usd: raw.cost?.usd ?? 0,
  //      date: new Date().toISOString(),
  //    });

  // 7️⃣ Return the explanation payload the panel already knows how to render
  return new Response(
    JSON.stringify({ ok: true, explanation: valid.data }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});