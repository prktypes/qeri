import { Sparkles } from 'lucide-react';

/** Loading skeleton — real latency exists in demo mode and will exist with AI. */
export function GeneratingState() {
  return (
    <div className="flex min-h-full flex-col gap-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-medium text-qeri-700 dark:text-qeri-200">
        <Sparkles className="h-4 w-4 animate-pulse" />
        Thinking about this post…
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        <div className="space-y-2">
          <div className="h-2.5 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-2.5 w-11/12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-2.5 w-8/12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-20 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
      </div>

      <div className="h-28 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
    </div>
  );
}
