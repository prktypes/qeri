import { z } from 'zod';
import { ExplainRequestSchema, ExplanationSchema } from '../schemas/explain';

/**
 * Extension-internal message envelope: content script → service worker.
 * The shape is validated at BOTH ends: the worker re-parses every inbound message
 * against the same schema (belt and braces — never trust runtime data, even our own).
 */

export const EXPLAIN_REQUEST_MSG = 'qeri/explain-request' as const;

export const ExplainRequestMessageSchema = z.object({
  type: z.literal(EXPLAIN_REQUEST_MSG),
  payload: ExplainRequestSchema,
});
export type ExplainRequestMessage = z.infer<typeof ExplainRequestMessageSchema>;

/** Service worker → content-script ack so the chip can stop flashing on failure. */
export const ExplainAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), explanationId: z.string() }),
  z.object({ ok: z.literal(false), error: z.string().min(1).max(300) }),
]);
export type ExplainAck = z.infer<typeof ExplainAckSchema>;

/** Runtime type guard for onMessage listeners. */
export function isExplainRequestMessage(value: unknown): value is ExplainRequestMessage {
  const parsed = ExplainRequestMessageSchema.safeParse(value);
  return parsed.success;
}

/* ------------------------------------------------------------------------ */
/* Library messages (panel → service worker, plan.md §Phase 4)               */
/*                                                                        */
/* The service worker is the ONLY writer of the saved-knowledge store:       */
/* single validated write path, so every context (panel open in a new tab,   */
/* future content-script save button, cloud sync) converges on one state.    */
/* Reads have no message — the panel subscribes to storage.onChanged.        */
/* ------------------------------------------------------------------------ */

export const LIBRARY_SAVE_MSG = 'qeri/library/save' as const;
export const LIBRARY_DELETE_MSG = 'qeri/library/delete' as const;
export const LIBRARY_CLEAR_MSG = 'qeri/library/clear' as const;

export const LibrarySaveMessageSchema = z.object({
  type: z.literal(LIBRARY_SAVE_MSG),
  payload: ExplanationSchema,
});
export const LibraryDeleteMessageSchema = z.object({
  type: z.literal(LIBRARY_DELETE_MSG),
  payload: z.object({ id: z.string().min(1).max(80) }),
});
export const LibraryClearMessageSchema = z.object({
  type: z.literal(LIBRARY_CLEAR_MSG),
});

export type LibrarySaveMessage = z.infer<typeof LibrarySaveMessageSchema>;
export type LibraryDeleteMessage = z.infer<typeof LibraryDeleteMessageSchema>;
export type LibraryClearMessage = z.infer<typeof LibraryClearMessageSchema>;

/** Superset ack of every library operation: the resulting entry count for UI badges. */
export const LibraryAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), total: z.number().int().nonnegative() }),
  z.object({ ok: z.literal(false), error: z.string().min(1).max(300) }),
]);
export type LibraryAck = z.infer<typeof LibraryAckSchema>;

/** Cool, message-typed routing guard for the service worker's switch. */
export const LibraryMessageSchema = z.discriminatedUnion('type', [
  LibrarySaveMessageSchema,
  LibraryDeleteMessageSchema,
  LibraryClearMessageSchema,
]);
export type LibraryMessage = z.infer<typeof LibraryMessageSchema>;

export function isLibraryMessage(value: unknown): value is LibraryMessage {
  const parsed = LibraryMessageSchema.safeParse(value);
  return parsed.success;
}
