import { useEffect, useState } from 'react';
import {
  LIBRARY_STORAGE_KEY,
  decodeLibrary,
  EMPTY_LIBRARY,
  type SavedLibrary,
} from '@qeri/shared';

/**
 * Subscribes the panel to the saved-knowledge store (plan.md §Phase 4).
 *
 * Reads own storage directly — the single-writer is the service worker, and every
 * mutation it performs arrives here through `chrome.storage.onChanged`, so all open
 * surfaces stay consistent with zero message fan-out. Malformed payloads are
 * rejected (they can never be written, but we answer defense-in-depth anyway).
 */
export function useSavedLibrary(): SavedLibrary {
  const [library, setLibrary] = useState<SavedLibrary>(EMPTY_LIBRARY);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await chrome.storage.local.get(LIBRARY_STORAGE_KEY);
      if (cancelled) return;
      setLibrary(decodeLibrary(stored[LIBRARY_STORAGE_KEY]) ?? EMPTY_LIBRARY);
    })();

    const listener = (changes: { [key: string]: unknown }, areaName: string): void => {
      if (areaName !== 'local') return;
      const change = (changes as Record<string, { newValue?: unknown }>)[LIBRARY_STORAGE_KEY];
      if (!change) return;
      const parsed = decodeLibrary(change.newValue);
      if (parsed) {
        setLibrary(parsed);
      } else {
        console.warn('[qeri:panel]', 'rejected malformed library update');
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  return library;
}
