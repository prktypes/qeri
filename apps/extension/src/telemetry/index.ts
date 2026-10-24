// Phase 5: error telemetry scaffold (plan.md §Reliability)
// Exposes a simple `reportError` function that can be called from anywhere
// in the extension (SW, panel, content script).  Currently it only logs to
// the console with a `[qeri:telemetry]` prefix.  When Sentry or a custom
// backend is configured (Phase 8+), replace the implementation here — the
// call‑site API stays the same.
//
// Usage (from a service worker):
//   reportError(new Error('chip failed to decorate'), 'decorate-chip');
//
// Usage (from the panel):
//   reportError(error, 'panel-tab-switch');
export function reportError(
  error: Error,
  context: string,
  extra?: Record<string, unknown>,
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    context,
    ...extra,
  };
  // Console sink — replace with Sentry.captureException, or a custom
  // endpoint POST in a future phase.
  console.info('[qeri:telemetry]', payload);
}
