import {
  ExplanationSchema,
  LIBRARY_STORAGE_KEY,
  SavedLibrarySchema,
  decodeLibrary,
  emptyLibrary,
  removeSavedEntry,
  upsertSavedEntry,
  type Explanation,
  type LibraryAck,
  type SavedLibrary,
} from '@qeri/shared';

/**
 * Local saved-knowledge store (plan.md §Phase 4 stage 1).
 *
 * `chrome.storage.local` keeps the library persistent across browser restarts on the
 * SAME profile/browser. The SERVICE WORKER is the only writer (single validated write
 * path); the panel subscribes to `chrome.storage.onChanged` instead of requesting —
 * open panels, all tabs and future surfaces converge without message fan-out.
 *
 * Cloud stage (Phase 4 finish): the same functions become the mirror's sync points;
 * entries are already row-shaped for the Supabase table.
 */

const LOG = (...args: unknown[]): void => console.info('[qeri:sw]', ...args);

/** Reads the on-device library; malformed/missing data degrades to an empty one. */
export async function readLibrary(): Promise<SavedLibrary> {
  const stored = await chrome.storage.local.get(LIBRARY_STORAGE_KEY);
  return decodeLibrary(stored[LIBRARY_STORAGE_KEY]) ?? emptyLibrary();
}

/** The single write gate: an unvalidated payload never reaches storage. */
async function writeLibrary(library: SavedLibrary): Promise<void> {
  const parsed = SavedLibrarySchema.safeParse(library);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    LOG('refusing to write a malformed library', first?.path.join('.'), first?.message);
    throw new Error('Library write rejected by schema.');
  }
  await chrome.storage.local.set({ [LIBRARY_STORAGE_KEY]: parsed.data });
}

/** Upserts (dedupe by explanation id) and reports the resulting library size. */
export async function saveExplanation(explanation: unknown): Promise<LibraryAck> {
  const parsed = ExplanationSchema.safeParse(explanation);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    LOG('save rejected:', first?.path.join('.'), first?.message);
    return { ok: false, error: 'That explanation failed validation and was not saved.' };
  }

  try {
    const library = await readLibrary();
    const saved: { savedAt: string; explanation: Explanation } = {
      savedAt: new Date().toISOString(),
      explanation: parsed.data,
    };
    const entries = upsertSavedEntry(library.entries, saved);
    await writeLibrary({ version: 1, entries });
    LOG(`saved ${parsed.data.id} — library size ${entries.length}`);
    return { ok: true, total: entries.length };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown storage error.';
    LOG('save failed:', message);
    return { ok: false, error: 'Could not save to the local library.' };
  }
}

export async function deleteSavedExplanation(explanationId: string): Promise<LibraryAck> {
  try {
    const library = await readLibrary();
    const entries = removeSavedEntry(library.entries, explanationId);
    await writeLibrary({ version: 1, entries });
    LOG(`deleted ${explanationId} — library size ${entries.length}`);
    return { ok: true, total: entries.length };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown storage error.';
    LOG('delete failed:', message);
    return { ok: false, error: 'Could not remove that explanation.' };
  }
}

export async function clearSavedLibrary(): Promise<LibraryAck> {
  try {
    await writeLibrary(emptyLibrary());
    LOG('library cleared');
    return { ok: true, total: 0 };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown storage error.';
    LOG('clear failed:', message);
    return { ok: false, error: 'Could not clear the library.' };
  }
}
