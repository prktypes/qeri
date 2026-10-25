/**
 * happy-dom: chip decoration needs a real DOM with shadow roots.
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import type { ExplainRequest } from '@qeri/shared';
import { decorateArticle } from '../../../apps/extension/src/content/chip/explain-chip';
import type { SiteExtraction } from '../../../apps/extension/src/content/adapters/types';

/**
 * Chip placement regression guard.
 *
 * X hydrates its action bar after first paint, so `decorateArticle` must report
 * "not ready" instead of silently giving up. The observer uses that signal to retry.
 */

const REQUEST: ExplainRequest = {
  text: 'A post worth explaining.',
  mode: 'quick',
  language: 'en',
} as ExplainRequest;

function articleWithoutActionBar(): HTMLElement {
  const article = document.createElement('article');
  const text = document.createElement('div');
  text.textContent = REQUEST.text;
  article.append(text);
  return article;
}

function extractionFor(element: HTMLElement): SiteExtraction {
  return { element, request: REQUEST };
}

describe('decorateArticle', () => {
  it('reports not-ready while the action bar is missing', () => {
    const article = articleWithoutActionBar();
    expect(decorateArticle(extractionFor(article))).toBe(false);
    expect(article.querySelector('.qeri-explain-host')).toBeNull();
  });

  it('appends the chip once the action bar appears', () => {
    const article = articleWithoutActionBar();
    expect(decorateArticle(extractionFor(article))).toBe(false);

    const actionBar = document.createElement('div');
    actionBar.setAttribute('role', 'group');
    article.append(actionBar);

    expect(decorateArticle(extractionFor(article))).toBe(true);
    expect(article.querySelector('.qeri-explain-host')).not.toBeNull();
    expect(actionBar.querySelector('.qeri-explain-host')).not.toBeNull();
  });

  it('is idempotent — a second call never duplicates the chip', () => {
    const article = articleWithoutActionBar();
    const actionBar = document.createElement('div');
    actionBar.setAttribute('role', 'group');
    article.append(actionBar);

    expect(decorateArticle(extractionFor(article))).toBe(true);
    expect(decorateArticle(extractionFor(article))).toBe(true);
    expect(article.querySelectorAll('.qeri-explain-host')).toHaveLength(1);
  });
});
