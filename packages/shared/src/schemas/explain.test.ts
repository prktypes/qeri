import { describe, expect, it } from 'vitest';
import { ExplainRequestSchema, ExplanationSchema } from './explain';
import { createMockExplanation } from '../mocks/mock-explanation';
import { MAX_CONTEXT_CHARS, MAX_EXPLAIN_INPUT_CHARS } from '../constants';

describe('ExplainRequestSchema', () => {
  it('fills defaults for mode and language', () => {
    const parsed = ExplainRequestSchema.parse({ text: 'hello world' });
    expect(parsed.mode).toBe('simple');
    expect(parsed.language).toBe('en');
  });

  it('rejects empty text', () => {
    expect(ExplainRequestSchema.safeParse({ text: '' }).success).toBe(false);
  });

  it('validates handle shape with the @"prefix', () => {
    expect(
      ExplainRequestSchema.safeParse({ text: 'x', authorHandle: '@jane_doe' }).success,
    ).toBe(true);
    expect(
      ExplainRequestSchema.safeParse({ text: 'x', authorHandle: 'jane doe!' }).success,
    ).toBe(false);
  });

  it('enforces the input size cap', () => {
    const tooLong = 'a'.repeat(MAX_EXPLAIN_INPUT_CHARS + 1);
    expect(ExplainRequestSchema.safeParse({ text: tooLong }).success).toBe(false);
  });

  it('requires absolute https URLs for sourceUrl', () => {
    const ok = ExplainRequestSchema.safeParse({
      text: 'x',
      sourceUrl: 'https://x.com/a/status/1',
    });
    expect(ok.success).toBe(true);
    const relative = ExplainRequestSchema.safeParse({ text: 'x', sourceUrl: '/a/status/1' });
    expect(relative.success).toBe(false);
  });

  it('accepts optional thread context with its own size cap', () => {
    const ok = ExplainRequestSchema.safeParse({
      text: 'reply here',
      context: 'this is the parent post',
      contextKind: 'parent',
    });
    expect(ok.success).toBe(true);

    const tooLong = ExplainRequestSchema.safeParse({
      text: 'x',
      context: 'c'.repeat(MAX_CONTEXT_CHARS + 1),
    });
    expect(tooLong.success).toBe(false);

    const badKind = ExplainRequestSchema.safeParse({
      text: 'x',
      context: 'c',
      contextKind: 'unrelated',
    });
    expect(badKind.success).toBe(false);
  });
});

describe('createMockExplanation', () => {
  const request = ExplainRequestSchema.parse({
    text: 'Higher interest rates are compressing startup valuations.',
    authorHandle: '@founder',
    sourceUrl: 'https://x.com/founder/status/123',
  });

  it('produces an object that satisfies the real Explanation schema', () => {
    const explanation = createMockExplanation(request);
    expect(ExplanationSchema.safeParse(explanation).success).toBe(true);
  });

  it('flags itself as demo content and never claims to be a model', () => {
    const explanation = createMockExplanation(request);
    expect(explanation.meta.generator).toBe('mock');
    expect(explanation.caveats.some((c) => /demo/i.test(c))).toBe(true);
  });

  it('derives at least a summary and follow-ups', () => {
    const explanation = createMockExplanation(request);
    expect(explanation.summary.length).toBeGreaterThan(0);
    expect(explanation.followUps.length).toBeGreaterThan(0);
    expect(explanation.keyTerms.length).toBeGreaterThan(0);
  });
});
