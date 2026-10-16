import { z } from 'zod';
import { ExplainRequestSchema } from '../schemas/explain';

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
