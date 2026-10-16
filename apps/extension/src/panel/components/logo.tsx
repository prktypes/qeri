/** Inline SVG wordmark — no network fonts, no external requests (privacy stance). */
export function QeriLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Qeri logo">
      <defs>
        <linearGradient id="qeri-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#qeri-grad)" />
      <path
        d="M30.5 16.5h-13a1.5 1.5 0 0 0-1.5 1.5v10a1.5 1.5 0 0 0 1.5 1.5h3.2l3.6 3.9a.75.75 0 0 0 1.3-.52v-3.38h4.9a1.5 1.5 0 0 0 1.5-1.5v-10a1.5 1.5 0 0 0-1.5-1.5z"
        fill="#ffffff"
        opacity="0.95"
      />
      <circle cx="34.5" cy="34.5" r="4.5" fill="#fde047" stroke="#ffffff" strokeWidth="1.4" />
    </svg>
  );
}
