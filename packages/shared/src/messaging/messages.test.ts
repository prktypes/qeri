import { describe, expect, it } from 'vitest';
import {
  ExplainAckSchema,
  ExplainRequestSchema,
  isExplainRequestMessage,
} from '../messages';

const REQUEST = { text: 'hello', authorHandle: '@a', mode: 'quick' };

describe('messaging envelope', () => {
  it('recognizes a valid explain-request message', () => {
    const message = { type: 'qeri/explain-request', payload: REQUEST };
    expect(isExplainRequestMessage(message)).toBe(true);
  });

  it('rejects arbitrary messages', () => {
    expect(isExplainRequestMessage({ type: 'other/thing' })).toBe(false);
    expect(isExplainRequestMessage(null)).toBe(false);
    expect(isExplainRequestMessage('garbage')).toBe(false);
  });

  it('validates the ack union shape', () => {
    expect(ExplainAckSchema.safeParse({ ok: true, explanationId: 'x' }).success).toBe(true);
    expect(ExplainAckSchema.safeParse({ ok: false, error: 'why' }).success).toBe(true);
    expect(ExplainAckSchema.safeParse({ ok: 'yes' }).success).toBe(false);
  });

  it('workers re-validate payloads defensively (deep invalid payload fails guard)', () => {
    expect(isExplainRequestMessage({ type: 'qeri/explain-request', payload: {} })).toBe(
      false,
    );
    const parsed = ExplainRequestSchema.safeParse(REQUEST);
    expect(parsed.success).toBe(true);
  });
});
