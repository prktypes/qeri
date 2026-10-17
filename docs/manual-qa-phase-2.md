# Manual QA — Phase 2 (X extraction engine)

Companion to the Phase 1 checklist (`manual-qa-phase-1.md`). Phase 2 adds three things
to verify by hand on the live site: the **adapter refactor**, **thread context**, and
the **skip policies**. Everything from Phase 1 must still hold.

## Before you start

```bash
pnpm build:ext          # bundle apps/extension/dist from the current tree
```

`chrome://extensions` → Qeri → **reload ↻** → hard-refresh the x.com tab
(`Ctrl+Shift+R`). Content scripts only inject into page loads that happen after the
reload.

## Behavior matrix

| #   | Where on X                                                          | Expected                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Home feed, ordinary posts                                           | One chip per post in the action bar, never more, never on avatars or quote boxes                                                                                                                     |
| 2   | A post that quotes another post                                     | Chip on the **outer** post only. Explanation contains a **“Quotes this post”** card with the quoted text before “In simple terms”; demo summary gains “(this post quotes another post, shown below)” |
| 3   | Open any `x.com/<user>/status/<id>` detail page                     | Chips on the root post AND on replies. A reply's explanation shows a **“Replying to”** card containing the thread root's text                                                                        |
| 4   | Same detail page, the root post                                     | Root explanation has NO context card (it is the thread's first post)                                                                                                                                 |
| 5   | An image-only post (no text)                                        | No chip on it; nothing errors in the `[qeri:cs]` console                                                                                                                                             |
| 6   | A very long post (>4,000 chars is rare; long quote chains work too) | Source card text ends with “…” — never cut mid-word                                                                                                                                                  |
| 7   | Back-to-back timeline posts                                         | Post #2's explanation has NO “Replying to” card (timeline guard)                                                                                                                                     |
| 8   | Scroll a few hundred posts then scroll back up                      | No duplicated chips anywhere (WeakSet dedupe unchanged from Phase 1)                                                                                                                                 |

## Engine-level verification (no browser)

```bash
pnpm test        # 29 tests — includes the 6-fixture detection benchmark
```

If a test fails after a fixture change, the engine broke its contract — fix before
building.

## Selector-drift triage (what to do when X's DOM changes)

Symptom: chips vanish from some post shapes (not all), or context cards disappear /
show odd text, on live X while `pnpm test` is green.

1. On the live page, DevTools → Elements → select the misbehaving
   `article[data-testid="tweet"]`.
2. Run `copy($0.outerHTML)` in the console; study what differs from the matching
   fixture (missing testid? moved text node? different nesting?).
3. Update/extend the fixture + expectations in `tests/unit/adapters/x.test.ts`, fix
   the selector in `apps/extension/src/content/adapters/x.ts` (the only file allowed
   to know X's DOM), and keep the code contract intact.
4. If context is mislabeled (wrong kind), re-check the section rules:
   detail conversation vs `accessible-list` timeline guard — see plan.md Phase 2
   concepts.
5. Capture a NEW fixture for every surprising real-world shape per the fixture README.
