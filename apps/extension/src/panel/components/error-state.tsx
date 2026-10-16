import { AlertTriangle } from 'lucide-react';

/** Exhaustive error branch of the panel state machine. */
export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-full flex-col items-center justify-center gap-4 text-center"
      role="alert"
    >
      <div className="rounded-full bg-rose-100 p-4 dark:bg-rose-900/40">
        <AlertTriangle className="h-8 w-8 text-rose-600 dark:text-rose-300" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Something went wrong
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          The explanation could not be completed.
        </p>
      </div>

      <p className="max-w-sm rounded-lg bg-neutral-100 px-3 py-2 font-mono text-xs break-words text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
        {message}
      </p>

      <p className="text-[11px] text-neutral-400">
        Try clicking <span className="font-medium">✦ Explain</span> on the post again.
      </p>
    </div>
  );
}
