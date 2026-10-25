import type { ExplainRequest } from '@qeri/shared';
import type { SiteExtraction } from '../adapters/types';
import { requestExplanation } from '../messaging/send-explain';
import logoUrl from '../../assets/qeri-logo-16.png';

/**
 * The Explain chip (plan.md §Phase 1).
 *
 * Style isolation via shadow DOM: the chip's styles live inside the shadow root, so
 * X's stylesheet never touches our button, and no page script can easily grab our
 * internals (closed mode) — the chip is the only DOM we ever add to the host page.
 */

const HOST_CLASS = 'qeri-explain-host';
const BTN_CLASS = 'qeri-explain-btn';
const LABEL_CLASS = 'qeri-explain-label';

const HOST_CSS = `
  .qeri-chip {
    all: initial;
    display: inline-flex;
    margin-left: 8px;
    vertical-align: middle;
  }
  .${BTN_CLASS} {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 999px;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    color: #ffffff;
    background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
    border: 1px solid rgba(255, 255, 255, 0.25);
    cursor: pointer;
    user-select: none;
    transition: filter 120ms ease, transform 120ms ease, opacity 120ms ease;
  }
  .${BTN_CLASS}:hover { filter: brightness(1.12); }
  .${BTN_CLASS}:active { transform: translateY(1px); }
  .${BTN_CLASS}[data-state='loading'] { opacity: 0.65; pointer-events: none; }
  .${BTN_CLASS}[data-state='error'] {
    background: linear-gradient(135deg, #9f1239 0%, #be123c 100%);
  }
  .${LABEL_CLASS} { display: inline-block; }
`;

const BTN_HTML = `<img src="${logoUrl}" alt="" aria-hidden="true" style="width:14px;height:14px;border-radius:3px;"><span class="qeri-explain-label">Explain</span>`;

/**
 * Decorate one article with an Explain chip appended to its action bar.
 * Idempotent: an article that already carries a chip is skipped untouched.
 *
 * Returns `true` once the chip is present, `false` when the action bar is not in
 * the DOM yet. The observer uses that signal to re-schedule the article on the next
 * mutation instead of blacklisting it forever (X hydrates its action bars late).
 */
export function decorateArticle(extraction: SiteExtraction): boolean {
  const { element: article, request } = extraction;

  if (article.querySelector(`.${HOST_CLASS}`)) return true;

  // `div[role="group"]` is X's action bar (reply/repost/like/views). The bare
  // `[role="group"]` fallback covers layout variants where the tag differs.
  const actionBar =
    article.querySelector<HTMLElement>('div[role="group"]') ??
    article.querySelector<HTMLElement>('[role="group"]');
  if (!actionBar) return false; // not painted yet — retry on a later mutation

  const host = document.createElement('div');
  host.className = HOST_CLASS;

  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = HOST_CSS;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = BTN_CLASS;
  button.setAttribute('aria-label', 'Explain this post with Qeri');
  button.innerHTML = BTN_HTML;

  shadow.append(style, button);

  button.addEventListener('click', (click) => {
    // Keep X's own handlers from acting on our click (likes/replies live nearby).
    click.preventDefault();
    click.stopPropagation();
    void runExplainClick({ button, request });
  });

  actionBar.appendChild(host);
  return true;
}

async function runExplainClick(args: {
  button: HTMLButtonElement;
  request: ExplainRequest;
}): Promise<void> {
  const { button, request } = args;
  const label = button.querySelector(`.${LABEL_CLASS}`);

  console.debug('[qeri:cs]', 'explain clicked for post', request.statusId ?? '(no id)');

  const setState = (state: 'idle' | 'loading' | 'error'): void => {
    button.dataset.state = state;
  };
  const setErrorBrief = (text: string): void => {
    setState('error');
    if (label) label.textContent = text;
    window.setTimeout(() => {
      setState('idle');
      if (label) label.textContent = 'Explain';
    }, 2200);
  };

  setState('loading');
  try {
    const result = await requestExplanation(request);
    if (result.ok) {
      setState('idle');
    } else if (result.error.includes('context invalidated')) {
      // Page predates the last extension reload — its content script is orphaned.
      setErrorBrief('Reload');
    } else {
      setErrorBrief('Retry');
    }
  } catch {
    setErrorBrief('Failed');
  }
}
