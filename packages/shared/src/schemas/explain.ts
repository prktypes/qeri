import { z } from 'zod';
import {
  DEFAULT_EXPLAIN_LANGUAGE,
  EXPLAIN_CONTEXT_KINDS,
  EXPLAIN_MODES,
  MAX_AUTHOR_HANDLE_CHARS,
  MAX_CONTEXT_CHARS,
  MAX_EXPLAIN_INPUT_CHARS,
} from '../constants';

/**
 * The three explanation fidelity presets (plan.md §7):
 * - quick:   2–3 sentences + one takeaway
 * - simple:  summary + why it matters + terms + example (default)
 * - deep:    extra context, competing interpretations, follow-up learning
 */
export const ExplainModeSchema = z.enum(EXPLAIN_MODES);
export type ExplainMode = z.infer<typeof ExplainModeSchema>;

/**
 * Everything the model (or the mock) needs to explain one post. This is the wire
 * contract for the future `POST /explain` — keep it additive-only.
 */
export const ExplainRequestSchema = z.object({
  /** Post text, already normalized + truncated by the adapter. */
  text: z
    .string()
    .min(1, 'Post text is required')
    .max(MAX_EXPLAIN_INPUT_CHARS, 'Post text exceeds the size cap'),
  /** Author handle including "@". Optional — some embeds render without it. */
  authorHandle: z
    .string()
    .max(MAX_AUTHOR_HANDLE_CHARS)
    .regex(/^@[A-Za-z0-9_-]+$/, 'Handle must look like @name')
    .nullish(),
  /** Canonical https://x.com/.../status/<id> permalink when extractable. */
  sourceUrl: z.url('Source URL must be absolute https').nullish(),
  /** X status id when we managed to parse it from the permalink (Phase 2+ uses this). */
  statusId: z
    .string()
    .regex(/^\d{1,32}$/)
    .nullish(),
  /** Surrounding thread text — quote of another post or the parent of a reply. */
  context: z.string().max(MAX_CONTEXT_CHARS).nullish(),
  /** What kind of surrounding text `context` holds, so the UI can label it. */
  contextKind: z.enum(EXPLAIN_CONTEXT_KINDS).nullish(),
  mode: ExplainModeSchema.default('simple'),
  language: z
    .string()
    .length(2, 'Language must be a 2-letter base tag')
    .default(DEFAULT_EXPLAIN_LANGUAGE),
});
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

/**
 * One glossary entry rendered as a term/definition pair. */
export const KeyTermSchema = z.object({
  term: z.string().min(1).max(80),
  definition: z.string().min(1).max(400),
});
export type KeyTerm = z.infer<typeof KeyTermSchema>;

/**
 * The six content blocks the MODEL is responsible for (plan.md §Phase 3). This is
 * exactly what the OpenRouter prompt requests — and what `/explain` re-validates
 * server-side before composing the full payload. Identity/meta are added below by
 * the server, never asked of the model.
 */
export const ExplanationContentSchema = z.object({
  summary: z.string().min(1).max(600),
  whyItMatters: z.string().min(1).max(800),
  keyTerms: z.array(KeyTermSchema).max(8),
  example: z.string().min(1).max(800),
  caveats: z.array(z.string().min(1).max(300)).max(6),
  followUps: z.array(z.string().min(1).max(160)).max(6),
});
export type ExplanationContent = z.infer<typeof ExplanationContentSchema>;

/** Provenance block: who/what produced the explanation and at what cost/time. */
export const ExplanationMetaSchema = z.object({
  /** Who produced this explanation. */
  generator: z.enum(['mock', 'openrouter']),
  model: z.string().nullish(),
  cached: z.boolean(),
  generationMs: z.number().int().nonnegative(),
  schemaVersion: z.string(),
});
export type ExplanationMeta = z.infer<typeof ExplanationMetaSchema>;

/**
 * The full explanation payload the side panel renders — identical shape for demo mode
 * and the live model. The renderer must never branch on the generator, only the meta
 * block may differ; server-side re-validation guards the shape end to end.
 */
export const ExplanationSchema = ExplanationContentSchema.extend({
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  request: ExplainRequestSchema,
  meta: ExplanationMetaSchema,
});
export type Explanation = z.infer<typeof ExplanationSchema>;

/** Compact wire form used when listing saved explanations (Phase 4). */
export const ExplanationSourceSchema = z.object({
  text: z.string(),
  authorHandle: z.string().nullish(),
  sourceUrl: z.string().nullish(),
});
