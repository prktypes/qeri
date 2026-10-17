/**
 * happy-dom: real DOM parsing/layout-ish behavior for fixture HTML (innerText etc.),
 * while staying a fast plain-node test. Fixture knowledge lives in ../fixtures/README.md.
 * @vitest-environment happy-dom
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { MAX_EXPLAIN_INPUT_CHARS } from '@qeri/shared';
import { isOutermost } from '../../../apps/extension/src/content/detection/observe-feed';
import {
  X_SELECTORS,
  truncate,
  xAdapter,
} from '../../../apps/extension/src/content/adapters/x';

const FIXTURE_DIR = resolve(import.meta.dirname, '../../../tests/fixtures');

let feedBasic: Document;
let feedQuoted: Document;
let detailThread: Document;
let postNoText: Document;
let postLongText: Document;
let feedSectionGuard: Document;

beforeAll(() => {
  const parse = (name: string): Document =>
    new DOMParser().parseFromString(readFileSync(resolve(FIXTURE_DIR, name), 'utf8'), 'text/html');

  feedBasic = parse('feed-basic.html');
  feedQuoted = parse('feed-quoted.html');
  detailThread = parse('detail-thread.html');
  postNoText = parse('post-no-text.html');
  postLongText = parse('post-long-text.html');
  feedSectionGuard = parse('feed-section-guard.html');
});

function articles(doc: Document): HTMLElement[] {
  return Array.from(doc.querySelectorAll<HTMLElement>(X_SELECTORS.article));
}

describe('x adapter on recorded fixtures', () => {
  describe('feed-basic', () => {
    it('extracts both ordinary timeline posts with no context', () => {
      const [postA, postB] = articles(feedBasic);
      const a = xAdapter.extract(postA!);
      const b = xAdapter.extract(postB!);

      expect(a).not.toBeNull();
      expect(a!.request.text).toBe(
        "Vector databases trade recall for latency, and most teams don't realize they are paying in precision.",
      );
      expect(a!.request.authorHandle).toBe('@quantaresearch');
      expect(a!.request.sourceUrl).toBe('https://x.com/quantaresearch/status/1799834000000000000');
      expect(a!.request.statusId).toBe('1799834000000000000');
      expect(a!.request.context).toBeNull();
      expect(a!.request.contextKind).toBeNull();
      expect(a!.request.mode).toBe('simple');
      expect(a!.request.language).toBe('en');
      expect(a!.element).toBe(postA);

      expect(b).not.toBeNull();
      expect(b!.request.text).toBe(
        'Rewriting your whole stack in rust is a fun weekend but rarely a product decision.',
      );
      expect(b!.request.authorHandle).toBe('@miacodes');
      expect(b!.request.statusId).toBe('1799835000000000000');
      expect(b!.request.context).toBeNull();
    });

    it('detects both posts as outermost (chip-eligible)', () => {
      for (const article of articles(feedBasic)) {
        expect(isOutermost(article, xAdapter.postSelector)).toBe(true);
      }
    });
  });

  describe('feed-quoted', () => {
    it('attaches the quoted post text as quoted context', () => {
      const outer = articles(feedQuoted)[0]!;
      const extraction = xAdapter.extract(outer)!;

      expect(extraction.request.text).toBe(
        'This experiment settles the RAG versus long-context debate for me. The retrieved pipeline stays nightly fresh, the long window slowly rots.',
      );
      expect(extraction.request.authorHandle).toBe('@appliedml');
      expect(extraction.request.statusId).toBe('1799836000000000000');
      expect(extraction.request.context).toBe(
        'Embedding drift quietly degrades RAG answer quality within weeks; nobody notices until users complain.',
      );
      expect(extraction.request.contextKind).toBe('quoted');
    });

    it('never decorates the nested quoted article itself', () => {
      const [outer, quoted] = articles(feedQuoted);
      expect(quoted).toBeDefined();
      expect(isOutermost(outer!, xAdapter.postSelector)).toBe(true);
      expect(isOutermost(quoted!, xAdapter.postSelector)).toBe(false);
    });

    it('extracts the quoted article standalone without inherited context', () => {
      const quoted = articles(feedQuoted)[1]!;
      const extraction = xAdapter.extract(quoted)!;

      expect(extraction.request.text).toBe(
        'Embedding drift quietly degrades RAG answer quality within weeks; nobody notices until users complain.',
      );
      expect(extraction.request.authorHandle).toBe('@smallmodels');
      expect(extraction.request.context).toBeNull();
      expect(extraction.request.contextKind).toBeNull();
    });
  });

  describe('detail-thread', () => {
    it('gives replies the root post as parent context, root itself none', () => {
      const [root, reply1, reply2] = articles(detailThread);
      const rootText =
        'Ionomics papers suggest gut bacteria produce neurotransmitters in small but measurable amounts.';

      const rootExtraction = xAdapter.extract(root!)!;
      expect(rootExtraction.request.context).toBeNull();
      expect(rootExtraction.request.contextKind).toBeNull();

      const reply1Extraction = xAdapter.extract(reply1!)!;
      expect(reply1Extraction.request.authorHandle).toBe('@prebiotics');
      expect(reply1Extraction.request.statusId).toBe('1799839000000000000');
      expect(reply1Extraction.request.context).toBe(rootText);
      expect(reply1Extraction.request.contextKind).toBe('parent');

      const reply2Extraction = xAdapter.extract(reply2!)!;
      expect(reply2Extraction.request.context).toBe(rootText);
      expect(reply2Extraction.request.contextKind).toBe('parent');
    });

    it('still works when the root has no permalink (detail header omitted)', () => {
      const root = articles(detailThread)[0]!;
      const rootExtraction = xAdapter.extract(root)!;
      expect(rootExtraction.request.text).toContain('Ionomics');
      expect(rootExtraction.request.sourceUrl).toBeNull();
      expect(rootExtraction.request.statusId).toBeNull();
    });
  });

  describe('post-no-text', () => {
    it('skips media-only posts entirely (no chip, no request)', () => {
      expect(articles(postNoText)).toHaveLength(1);
      expect(xAdapter.extract(articles(postNoText)[0]!)).toBeNull();
    });

    it('records the available alt text in the fixture for the later media phase', () => {
      const img = postNoText.querySelector('img');
      expect(img?.getAttribute('alt')).toContain('GPU prices');
    });
  });

  describe('post-long-text', () => {
    it('truncates the oversized post at the shared size cap with an ellipsis', () => {
      const extraction = xAdapter.extract(articles(postLongText)[0]!)!;
      const { text } = extraction.request;

      expect(text.length).toBeLessThanOrEqual(MAX_EXPLAIN_INPUT_CHARS);
      expect(text.endsWith('\u2026')).toBe(true);
      expect(text.startsWith('This synthetic post')).toBe(true);
      expect(extraction.request.authorHandle).toBe('@longform');
      expect(extraction.request.statusId).toBe('1799838000000000000');
    });
  });

  describe('feed-section-guard', () => {
    it('never mints parent context between timeline posts (accessible-list sections)', () => {
      const [first, second] = articles(feedSectionGuard);

      expect(xAdapter.extract(first!)!.request.context).toBeNull();
      const secondExtraction = xAdapter.extract(second!)!;
      expect(secondExtraction.request.context).toBeNull();
      expect(secondExtraction.request.contextKind).toBeNull();
    });
  });
});

describe('post-level utilities', () => {
  it('truncate keeps a word boundary whenever it stays respectable', () => {
    expect(truncate('short', 10)).toBe('short');

    const aboveCap = 'word '.repeat(30); // 150 chars
    const cut = truncate(aboveCap, 100);
    // Either a word-boundary cut ... or a hard cut filling the cap exactly.
    if (cut.includes(' ')) {
      expect(cut.trimEnd().length).toBeLessThanOrEqual(99);
    }
    expect(cut.endsWith('\u2026')).toBe(true);
    expect(cut).not.toMatch(/\w\.\u2026$/); // never clips mid-word-and-period
  });
});

describe('detection benchmark across all fixtures', () => {
  it('decorates exactly the intended posts (9 of 11 articles, quoted box excluded)', () => {
    const suits: Array<[string, Document, number]> = [
      ['feed-basic', feedBasic, 2],
      ['feed-quoted', feedQuoted, 1], // outer only; the quoted box is decoration-exempt
      ['detail-thread', detailThread, 3],
      ['post-no-text', postNoText, 0],
      ['post-long-text', postLongText, 1],
      ['feed-section-guard', feedSectionGuard, 2],
    ];

    let chips = 0;
    let parsed = 0;
    for (const [, doc, expected] of suits) {
      const decorated = articles(doc).filter((article) => {
        if (!isOutermost(article, xAdapter.postSelector)) return false;
        return xAdapter.extract(article) !== null;
      });
      parsed += articles(doc).length;
      chips += decorated.length;
      expect(decorated.length, `${doc.title}: chip count`).toBeGreaterThanOrEqual(expected);
    }

    // 11 articles rendered across the fixtures; 9 chip targets by design
    // (the quoted preview is skipped — its outer post carries the explanation).
    expect(parsed).toBe(11);
    expect(chips).toBe(9);
  });
});
