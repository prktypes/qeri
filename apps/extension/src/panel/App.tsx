import { useState } from 'react';
import { usePanelState } from './use-panel-state';
import { useSavedLibrary } from './use-saved-library';
import { PanelHeader, type PanelTab } from './components/panel-header';
import { IdleState } from './components/idle-state';
import { GeneratingState } from './components/generating-state';
import { ErrorState } from './components/error-state';
import { ExplanationView } from './components/explanation-view';
import { LibraryView } from './components/library-view';
import type { SavedExplanation } from '@qeri/shared';

/**
 * App shell (plan.md §Phase 4).
 *
 * Two tabs over one content area: 'Explain' renders the existing PanelState machine,
 * 'Library' renders the saved-knowledge store. A saved entry can be re-opened
 * (`viewing`) — the SAME ExplanationView renders it, because saved and fresh
 * explanations share one shape; only the chrome around them differs (back bar).
 */
export function App() {
  const state = usePanelState();
  const library = useSavedLibrary();

  const [tab, setTab] = useState<PanelTab>('explain');
  const [viewing, setViewing] = useState<SavedExplanation | null>(null);

  function switchTab(next: PanelTab): void {
    setViewing(null); // both tabs reset any borrowed view
    setTab(next);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto w-full max-w-xl p-4">
        <PanelHeader tab={tab} onTabChange={switchTab} libraryCount={library.entries.length} />

        {tab === 'explain' && (
          <>
            {state.kind === 'idle' && <IdleState />}
            {state.kind === 'generating' && <GeneratingState />}
            {state.kind === 'ready' && (
              <ExplanationView
                explanation={state.explanation}
                saved={library.entries.some(
                  (entry) => entry.explanation.id === state.explanation.id,
                )}
              />
            )}
            {state.kind === 'error' && <ErrorState message={state.message} />}
          </>
        )}

        {tab === 'library' &&
          (viewing ? (
            <ExplanationView
              explanation={viewing.explanation}
              saved={true}
              onBack={() => setViewing(null)}
            />
          ) : (
            <LibraryView library={library} onOpen={setViewing} />
          ))}
      </div>
    </div>
  );
}
