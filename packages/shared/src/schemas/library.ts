import { z } from 'zod';
import { ExplanationSchema } from './explain';
import { MAX_LIBRARY_ENTRIES } from '../constants';

/**
 * The saved-knowledge contract (plan.md §Phase 4).
 *
 * Explanations are saved as immutable artifacts. The shape wraps the FULL
 * Explanation — the panel can re-render a saved entry without any transformation —
 * plus the moment it was saved. Entries dedupe by the explanation's content id:
 * re-saving the same post refreshes its position, never duplicates storage.
 *
 * Storage stage 1: `chrome.storage.local` (persistent, per-browser). Cloud stage:
 * the same entries sync via Supabase (see supabase/migrations) — the wire shape is
 * already row-shaped (one entry = one row), so the sync layer maps 1:1.
 */

/** Storage key for the on-device library mirror. */
export const LIBRARY_STORAGE_KEY = 'qeri.library.v1';

export const SavedExplanationSchema = z.object({
  /** ISO timestamp of when the user pressed Save (drives newest-first ordering). */
  savedAt: z.iso.datetime(),
  /** The immutable, fully validated explanation artifact. */
  explanation: ExplanationSchema,
});
export type SavedExplanation = z.infer<typeof SavedExplanationSchema>;

/** Library envelope: `version` lets future migrations transform old payloads safely. */
export const SavedLibrarySchema = z.object({
  version: z.literal(1),
  entries: z.array(SavedExplanationSchema).max(MAX_LIBRARY_ENTRIES),
});
export type SavedLibrary = z.infer<typeof SavedLibrarySchema>;

/** The only valid empty library — reuse instead of hand-building objects. */
export const EMPTY_LIBRARY: SavedLibrary = { version: 1, entries: [] };

/** Structural decode: anything malformed becomes null (callers fall back to empty). */
export function decodeLibrary(value: unknown): SavedLibrary | null {
  const parsed = SavedLibrarySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Pure store operations — the service worker is the ONLY writer, and it composes
 * these helpers with a validated read/write of the storage key (plan.md §single
 * writer). Exposed from shared so tests and the future sync layer share one truth.
 */

/**
 * Upsert by the explanation's content id: re-saving refreshes `savedAt` (bumping the
 * entry to the top) without duplicating. Array is kept newest-first and capped at
 * MAX_LIBRARY_ENTRIES (oldest evicted).
 */
export function upsertSavedEntry(
  entries: readonly SavedExplanation[],
  saved: SavedExplanation,
): SavedExplanation[] {
  const rest = entries.filter((entry) => entry.explanation.id !== saved.explanation.id);
  return [saved, ...rest].slice(0, MAX_LIBRARY_ENTRIES);
}

export function removeSavedEntry(
  entries: readonly SavedExplanation[],
  explanationId: string,
): SavedExplanation[] {
  return entries.filter((entry) => entry.explanation.id !== explanationId);
}

export function findSavedEntry(
  entries: readonly SavedExplanation[],
  explanationId: string,
): SavedExplanation | null {
  return entries.find((entry) => entry.explanation.id === explanationId) ?? null;
}

/** The never-fails reset: schema-versioned empty library. */
export function emptyLibrary(): SavedLibrary {
  return { version: 1, entries: [] };
}
