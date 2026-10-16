import { usePanelState } from './use-panel-state';
import { PanelHeader } from './components/panel-header';
import { IdleState } from './components/idle-state';
import { GeneratingState } from './components/generating-state';
import { ErrorState } from './components/error-state';
import { ExplanationView } from './components/explanation-view';

/**
 * App shell: an exhaustive switch over the shared PanelState union (plan.md §schemas).
 * TypeScript enforces that every `kind` renders — adding a state to the schema makes
 * this switch a compile error until it renders.
 */
export function App() {
  const state = usePanelState();

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto w-full max-w-xl p-4">
        <PanelHeader />
        {state.kind === 'idle' && <IdleState />}
        {state.kind === 'generating' && <GeneratingState />}
        {state.kind === 'ready' && <ExplanationView explanation={state.explanation} />}
        {state.kind === 'error' && <ErrorState message={state.message} />}
      </div>
    </div>
  );
}
