import { QeriLogo } from './logo';

export type PanelTab = 'explain' | 'library';

/** Panel header — brand, live/demo status, and the Explain | Library tab switch. */
export function PanelHeader({
  tab,
  onTabChange,
  libraryCount,
}: {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  libraryCount: number;
}) {
  return (
    <header className="mb-4" aria-label="Qeri header">
      <div className="flex items-center gap-3">
        <QeriLogo className="h-9 w-9 rounded-lg" aria-hidden="true" />
        <div>
          <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Qeri</h1>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            v0.3.0 · live AI when the Qeri service is up, demo otherwise
          </p>
        </div>
      </div>

      <nav
        role="tablist"
        aria-label="Qeri sections"
        aria-describedby="qeri-header-desc"
        className="mt-3 flex w-full gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900"
      >
        <p id="qeri-header-desc" className="sr-only">
          Qeri side panel — toggle between Explain and Library sections
        </p>
        <TabButton
          active={tab === 'explain'}
          onClick={() => onTabChange('explain')}
          label="Explain"
        />
        <TabButton
          active={tab === 'library'}
          onClick={() => onTabChange('library')}
          label="Library"
          badge={libraryCount > 0 ? String(libraryCount) : undefined}
        />
      </nav>
    </header>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'bg-white text-qeri-700 shadow-sm dark:bg-neutral-800 dark:text-qeri-300'
          : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
      }`}
    >
      {label}
      {badge && (
        <span className="rounded-full bg-qeri-100 px-1.5 py-0.5 text-[10px] font-bold text-qeri-700 dark:bg-qeri-700/40 dark:text-qeri-200">
          {badge}
        </span>
      )}
    </button>
  );
}
