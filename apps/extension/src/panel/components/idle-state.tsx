import { MousePointerClick } from 'lucide-react';

/** Shown when no explanation has been requested yet in this browsing session. */
export function IdleState() {
  const steps = [
    ['1', 'Open your X feed', 'Scroll like you normally do.'],
    ['2', 'Spot the ✦ chip', 'Every supported post gets an Explain chip on its action bar.'],
    ['3', 'Click Explain', 'The panel you are reading opens with a structured explanation.'],
  ];

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 text-center">
      <div className="rounded-full bg-qeri-100 p-4 dark:bg-qeri-700/30">
        <MousePointerClick className="h-8 w-8 text-qeri-600 dark:text-qeri-200" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Nothing explained yet
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Explanations live here for this browsing session.
        </p>
      </div>

      <ol className="flex w-full max-w-xs flex-col gap-3 text-left">
        {steps.map(([step, title, detail]) => (
          <li
            key={step}
            className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-qeri-600 text-xs font-bold text-white">
              {step}
            </span>
            <span>
              <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {title}
              </span>
              <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                {detail}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="text-[11px] text-neutral-400">
        Tip: <kbd className="rounded border px-1">Alt</kbd> +{' '}
        <kbd className="rounded border px-1">Q</kbd> opens this panel anytime.
      </p>
    </div>
  );
}
