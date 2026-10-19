import { describe, expect, it } from 'vitest';
import {
  EMPTY_LIBRARY,
  LIBRARY_STORAGE_KEY,
  SavedLibrarySchema,
  SavedExplanationSchema,
  decodeLibrary,
  emptyLibrary,
  findSavedEntry,
  removeSavedEntry,
  upsertSavedEntry,
} from './library';
import { createMockExplanation } from '../mocks/mock-explanation';
import { MAX_LIBRARY_ENTRIES } from '../constants';

function makeEntry(id: string, savedAt: string) {
  const explanation = createMockExplanation({
    text: `post ${id}`,
    mode: 'simple',
    language: 'en',
  });
  return { savedAt, explanation: { ...explanation, id } };
}

describe('SavedLibrary contract', () => {
  it('validates the empty library and rejects malformed shapes', () => {
    expect(SavedLibrarySchema.safeParse(EMPTY_LIBRARY).success).toBe(true);
    expect(SavedLibrarySchema.safeParse({ version: 1 }).success).toBe(false);
    expect(SavedLibrarySchema.safeParse({ version: 2, entries: [] }).success).toBe(false);
    expect(
      SavedLibrarySchema.safeParse({ version: 1, entries: [{ savedAt: 'not a date' }] })
        .success,
    ).toBe(false);
  });

  it('wraps a full, already-valid Explanation per entry', () => {
    const entry = makeEntry('ai-1', '2026-10-19T10:00:00.000Z');
    expect(SavedExplanationSchema.safeParse(entry).success).toBe(true);
  });

  it('declares the storage key so panel and worker never drift apart', () => {
    expect(LIBRARY_STORAGE_KEY).toBe('qeri.library.v1');
  });

  it('decodeLibrary is total: garbage becomes null, valid data passes', () => {
    expect(decodeLibrary(null)).toBeNull();
    expect(decodeLibrary({ weird: true })).toBeNull();
    const lib = decodeLibrary({ version: 1, entries: [] });
    expect(lib).toEqual({ version: 1, entries: [] });
  });
});

describe('pure store operations', () => {
  it('upsert: newest first, re-save refreshes position without duplicating', () => {
    // Production arrays are ALWAYS newest-first (reads only ever see our writes).
    let entries = [
      makeEntry('b', '2026-10-19T10:00:00.000Z'),
      makeEntry('a', '2026-10-19T09:00:00.000Z'),
    ];
    entries = upsertSavedEntry(entries, makeEntry('c', '2026-10-19T11:00:00.000Z'));
    expect(entries.map((e) => e.explanation.id)).toEqual(['c', 'b', 'a']);

    entries = upsertSavedEntry(entries, makeEntry('a', '2026-10-19T12:00:00.000Z'));
    expect(entries.map((e) => e.explanation.id)).toEqual(['a', 'c', 'b']); // moved, not duplicated
  });

  it('upsert caps at MAX_LIBRARY_ENTRIES, evicting the oldest', () => {
    // Seed newest-first: e499 (latest) at the front, e0 (oldest) at the tail.
    let entries: ReturnType<typeof makeEntry>[];
    entries = Array.from({ length: MAX_LIBRARY_ENTRIES }, (_, i) =>
      makeEntry(`e${499 - i}`, new Date(2026, 0, 1, 0, 0, 499 - i).toISOString()),
    );
    entries = upsertSavedEntry(entries, makeEntry('fresh', '2026-10-19T12:00:00.000Z'));
    expect(entries).toHaveLength(MAX_LIBRARY_ENTRIES);
    expect(entries.find((e) => e.explanation.id === 'e0')).toBeUndefined(); // oldest evicted
    expect(entries[0]?.explanation.id).toBe('fresh');
  });

  it('remove + find operate purely by explanation id', () => {
    const entries = [
      makeEntry('a', '2026-10-19T09:00:00.000Z'),
      makeEntry('b', '2026-10-19T10:00:00.000Z'),
    ];
    expect(findSavedEntry(entries, 'b')?.explanation.id).toBe('b');
    expect(findSavedEntry(entries, 'zzz')).toBeNull();
    expect(removeSavedEntry(entries, 'a').map((e) => e.explanation.id)).toEqual(['b']);
    expect(removeSavedEntry(entries, 'zzz')).toEqual(entries); // untouched
  });

  it('emptyLibrary() is the only sanctioned reset', () => {
    expect(emptyLibrary()).toEqual({ version: 1, entries: [] });
  });
});
