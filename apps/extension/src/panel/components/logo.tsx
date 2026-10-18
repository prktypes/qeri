import logoUrl from '../../assets/qeri-logo-128.png';

/**
 * The Qeri mascot as a bundled PNG — the same mark as the toolbar icon, so the
 * extension reads as one product everywhere Chrome surfaces it. Inlined by Vite
 * (no network requests, no external fonts — privacy stance stays intact).
 */
export function QeriLogo({ className }: { className?: string }) {
  return <img src={logoUrl} alt="Qeri logo" className={className} draggable={false} />;
}
