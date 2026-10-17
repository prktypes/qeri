import { useEffect, useState } from 'react';
import {
  INITIAL_PANEL_STATE,
  PANEL_STATE_STORAGE_KEY,
  PanelStateSchema,
  type PanelState,
} from '@qeri/shared';

/**
 * Reads the panel state machine from chrome.storage.session and keeps the React view
 * subscribed to live changes (plan.md §Chrome messaging). On mount we read once, then
 * every service-worker write flows through storage.onChanged without extra plumbing.
 */
export function usePanelState(): PanelState {
  const [state, setState] = useState<PanelState>(INITIAL_PANEL_STATE);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await chrome.storage.session.get(PANEL_STATE_STORAGE_KEY);
      if (cancelled) return;
      const parsed = PanelStateSchema.safeParse(stored[PANEL_STATE_STORAGE_KEY]);
      if (parsed.success) {
        console.info('[qeri:panel]', 'mounted with state:', parsed.data.kind);
        setState(parsed.data);
      } else {
        console.info('[qeri:panel]', 'mounted with no stored state — showing idle');
      }
    })();

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ): void => {
      if (areaName !== 'session') return;
      const change = changes[PANEL_STATE_STORAGE_KEY];
      if (!change) return;
      const parsed = PanelStateSchema.safeParse(change.newValue);
      if (parsed.success) {
        console.info('[qeri:panel]', 'state change →', parsed.data.kind);
        setState(parsed.data);
      } else {
        console.warn('[qeri:panel]', 'rejected malformed panel state:', change.newValue);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  return state;
}
