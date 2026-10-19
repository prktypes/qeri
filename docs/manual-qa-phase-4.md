# Manual QA — Phase 4 stage 1 (saved knowledge, local-first)

Companion to the Phase 3 live-AI checklist and the Phase 2 matrix. Stage 1 adds the
**saved library**: save/open/delete/clear from the side panel, persistence in
`chrome.storage.local`. Everything from Phases 0–3 must still hold — run the older
matrices when a regression is suspected, not this one alone.

## Before you start

```bash
pnpm build:ext          # bundle apps/extension/dist from the current tree
```

`chrome://extensions` → Qeri → **reload ↻** → hard-refresh the x.com tab
(`Ctrl+Shift+R`) — stale content scripts never see the new panel markup.

## Save flows

| #   | Action                                                                      | Expected                                                                                                           |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Explain any post, press **Save** on the card (next to the provenance badge) | Button flips to a **saved** chip immediately; the **Library** tab badge appears with count `1`                     |
| 2   | Press **Save** again on a post already saved                                | `saved` chip regardless — the worker upserts (no second entry); its timestamp/position refresh in the Library list |
| 3   | Explain a SECOND different post, press Save                                 | Library count becomes `2`; the newest entry is first (newest-first ordering)                                       |
| 4   | Watch the Library tab while saving from the Explain tab                     | The badge count updates WITHOUT refreshing the panel (`storage.onChanged` subscription)                            |
| 5   | Save with the API stopped (demo fallback explanation)                       | Demo explanations save fine — the artifact is generator-agnostic; its row dot is purple vs emerald for live        |

## Library flows

| #   | Action                                             | Expected                                                                                                                                            |
| --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Open the **Library** tab                           | Header shows "Saved knowledge" + count + "stored locally in this browser"; entries show author, save time, engine dot, 2-line post preview          |
| 7   | Press **Open** on an entry                         | The SAME structured explanation card renders with a **← Library** back bar and a `saved` chip; every section (summary/terms/caveats/context) intact |
| 8   | Press **← Library**                                | Return to the list; count unchanged                                                                                                                 |
| 9   | Delete ONE entry via the trash button in its row   | The row disappears immediately; the count updates; no error surfaces in `[qeri:sw]`                                                                 |
| 10  | Press **Clear all** once                           | It arms into a red **Clear everything?**; wait ~4 s — it disarms itself back to "Clear all" WITHOUT clearing (stray-click protection)               |
| 11  | Press **Clear all**, then **Clear everything?**    | Library purges; the empty state appears ("Nothing saved yet… Explain a post and press Save"); Explain-tab save buttons become active again          |
| 12  | Open a saved entry, switch to Explain, switch back | You land on the LIST (borrowed view resets on tab change) — the viewed entry is never "lost" since it's still saved                                 |

## Persistence

| #   | Action                                                       | Expected                                                                                                                        |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 13  | Close the side panel, reopen it from a chip click            | Library badge count unchanged; entries intact                                                                                   |
| 14  | Restart Chrome entirely, open the panel                      | Entries persist (`chrome.storage.local` is profile-scoped, not session)                                                         |
| 15  | DevTools → Application → Storage → Extension storage → local | Key `qeri.library.v1` holds `{ "version": 1, "entries": [...] }` — every entry's `explanation` matches the Explanation contract |

## Engine-level verification (no browser)

```bash
pnpm test        # 47 tests — includes the library contract + store-op suites
```

## Failure triage

- **Save does nothing / badge unchanged** — panel right-click → _Inspect_ console:
  look for `[qeri:panel] rejected malformed library update` (send the exact message);
  `[qeri:sw]` should show `saved <id> — library size N`. If the worker log is absent,
  the message never left the panel — check the ack failure path prints
  `Qeri service worker did not respond.`.
- **Entries vanish after a full clear in a second panel** — expected convergence, not
  a bug: both surfaces subscribe to the same store, the LAST write wins everywhere.
- **`Package size exceeds` errors in `[qeri:sw]`** — the 500-entry cap evicts oldest
  entries instead; a crash here would signal the write gate refusing a malformed
  library (the log line names the offending schema path).
