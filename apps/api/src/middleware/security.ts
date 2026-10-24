// Phase 5: security headers (defence-in-depth, plan.md §Reliability)
// Applied to every response via a Hono middleware.  These headers complement
// the Content-Security-Policy already declared in the extension manifest
// (manifest.ts) and reduce the attack surface for the API surface area.

// Hono middleware: sets security headers on every response.
export function securityHeaders(c: unknown, next: () => void): void {
  const ctx = c as { header: (key: string, value: string) => void };
  ctx.header('X-Content-Type-Options', 'nosniff');
  ctx.header('X-Frame-Options', 'DENY');
  ctx.header('X-XSS-Protection', '1; mode=block');
  ctx.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  // HSTS is omitted from the dev server (localhost) to avoid locking out
  // local tooling; it will be enabled when the Edge Function is deployed
  // behind HTTPS (Phase 4 → Stage 2).
  next();
}
