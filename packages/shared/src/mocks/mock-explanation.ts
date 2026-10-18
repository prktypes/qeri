import type { ExplainRequest, Explanation, KeyTerm } from '../schemas/explain';
import { EXPLANATION_SCHEMA_VERSION } from '../constants';

/**
 * Demo-mode explanation generator.
 *
 * Runs *locally* in the service worker — no network, no keys. It exists so the entire
 * UI/message/storage pipeline can be built and tested before an OpenRouter key exists
 * (plan.md §Phase 1). Phase 3 swaps this function for a real model client; nothing
 * else changes because the returned object satisfies the same Zod schema.
 *
 * Copy rules for the mock: it must never fabricate subject-matter claims about the
 * post. It describes the post's shape and flags itself as demo content in caveats —
 * honest, deterministic, and cheap.
 */

export class MockExplainer {
  private readonly t0: number;

  constructor(private readonly seed = Math.random().toString()) {
    // capture wall-clock at construction so generationMs reflects real overhead
    this.t0 = Date.now();
  }

  explain(request: ExplainRequest): Explanation {
    const createdAt = new Date().toISOString();
    const firstSentences = splitSentences(request.text);
    const topic = summarizeTopic(firstSentences);
    const terms = deriveTerms(firstSentences[0] ?? request.text);

    return {
      id: `mock-${this.seedRef()}`,
      createdAt,
      request,
      summary: summaryFor(request, topic),
      whyItMatters: whyItMattersFor(request),
      keyTerms: terms,
      example: exampleFor(request),
      caveats: [
        `Demo content — generated locally by Qeri, not by a language model (the Qeri service is unreachable right now).`,
        `No sources were consulted. Live explanations will cite their limits carefully.`,
      ],
      followUps: [
        'Why does this matter?',
        'Simplify it for someone outside this field',
        'Show a concrete example',
        'What would change this conclusion?',
      ],
      meta: {
        generator: 'mock',
        model: null,
        cached: false,
        generationMs: Math.max(1, Date.now() - this.t0),
        schemaVersion: EXPLANATION_SCHEMA_VERSION,
      },
    };
  }

  private seedRef(): string {
    // pseudo-random but unique per click: keeps ids sortable-ish without a UUID dep
    const rand = Math.random().toString(36).slice(2, 8);
    return `${rand}-${this.seedAlpha()}`;
  }

  private seedAlpha(): string {
    return this.seed.replace(/[^a-z0-9]/gi, '').slice(0, 4) || 'qeri';
  }
}

/** Convenience wrapper matching the Phase-3 call signature (request) => Explanation. */
export function createMockExplanation(request: ExplainRequest): Explanation {
  return new MockExplainer().explain(request);
}

/** Sentence splitter good enough for demo copy (no NLP dependency). */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}

/** Topic =Device the first clause, trimmed to a tweetable core. */
function summarizeTopic(sentences: string[]): string {
  const first = sentences[0] ?? '';
  return first.length > 120 ? `${first.slice(0, 117)}…` : first;
}

/** Very small heuristic glossary: longest distinctive words become “terms”. */
function deriveTerms(sentence: string): KeyTerm[] {
  const words = (sentence.match(/[A-Za-z][A-Za-z-]{4,}/g) ?? [])
    .filter((w) => !STOPWORDS.has(w.toLowerCase()))
    .sort((a, b) => b.length - a.length)
    .slice(0, 2);

  return words.map((word) => ({
    term: word,
    definition:
      word.length > 9
        ? `A specialized or long word used in the post — worth looking up when demo mode ends.`
        : `A word the demo picker found interesting in your post.`,
  }));
}

const STOPWORDS = new Set([
  'about',
  'after',
  'again',
  'because',
  'before',
  'being',
  'covid',
  'during',
  'every',
  'others',
  'should',
  'their',
  'there',
  'these',
  'those',
  'under',
  'until',
  'while',
  'would',
  'which',
]);

function summaryFor(request: ExplainRequest, topic: string): string {
  const by = request.authorHandle ? ` by ${request.authorHandle}` : '';
  return `This is a demo explanation of a post${by}. The opening idea was: “${topic}”${contextNoteFor(
    request,
  )} — in Phase 3 a language model will rewrite this into an accurate plain-English summary.`;
}

/** Demo narration for thread context: describes shape, echoes nothing as fact. */
function contextNoteFor(request: ExplainRequest): string {
  if (!request.context || !request.contextKind) return '';
  const shape =
    request.contextKind === 'quoted'
      ? 'quotes another post'
      : request.contextKind === 'parent'
        ? 'is a reply inside a thread'
        : 'has surrounding thread context';
  return ` (this post ${shape}, shown below)`;
}

function whyItMattersFor(request: ExplainRequest): string {
  return `Qeri's value is context without leaving the page. This demo text proves the pipeline: extraction → message → panel state → render. Live model-powered analysis appears here whenever the Qeri service is reachable${
    request.mode === 'deep' ? ' (deep mode will expand competing interpretations).' : '.'
  }`;
}

function exampleFor(request: ExplainRequest): string {
  return `Try a different post to see the flow again${
    request.sourceUrl ? ` (this one was captured from ${request.sourceUrl})` : ''
  }. When the Qeri service is reachable, this slot shows a real concrete analogy generated from the post's subject.`;
}
