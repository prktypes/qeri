import { QeriLogo } from './logo';

/** Panel header — brand + demo badge; explains the version at a glance. */
export function PanelHeader() {
  return (
    <header className="mb-4 flex items-center gap-3">
      <QeriLogo className="h-9 w-9 rounded-lg" />
      <div>
        <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Qeri</h1>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          v0.3.0 · live AI when the Qeri service is up, demo otherwise
        </p>
      </div>
    </header>
  );
}
