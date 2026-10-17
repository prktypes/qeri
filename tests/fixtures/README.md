# X DOM fixtures (Phase 2)

Structural captures of the shapes the qeri X adapter must survive. Each file is a
standalone HTML document whose articles carry the exact structural attributes the
adapter's selectors key on — `data-testid`, `role="group"`, permalink `href`s,
the conversation/timeline `section` wrappers — plus realistic class noise to prove
selectors never depend on obfuscated CSS class names.

## What each fixture encodes

| Fixture | Shape | Expected engine behavior |
| --- | --- | --- |
| `feed-basic.html` | Two ordinary timeline posts | Both extracted: text, `@handle`, permalink+statusId, no context |
| `feed-quoted.html` | Post quoting another post (nested article) | Outer post extracted; quoted text attached as `context`/`quoted`; the nested article itself is never decorated (`isOutermost` = false) |
| `detail-thread.html` | Status detail page, one `section[aria-labelledby]` holding root + two replies | Replies inherit the root's text as `context`/`parent`; the root itself has no context |
| `post-no-text.html` | Media-only post with alt text | Extraction returns null → no chip (image explanation is a later phase) |
| `post-long-text.html` | ~4,440-char post | Text truncated to the 4,000-char cap with an ellipsis tail |
| `feed-section-guard.html` | Timeline `section` whose a11y heading id starts with `accessible-list` | Regression guard: timeline posts never inherit each other as parent context |

All accents/handles/names are synthetic; nothing here is real user content.

## Adapting these to the wild (capture checklist)

Phase 2 fixtures encode *our assumptions* about X's DOM. When a selector erodes —
X is a fast-moving target — capture a fresh fixture from the live site instead of
guessing: on the page in question, open DevTools, select the offending
`article[data-testid="tweet"]`, and run

```js
copy(document.querySelector('article[data-testid="tweet"]').outerHTML)
```

then rebuild a standalone document around it, keeping only the structural
attributes you actually see (`data-testid`, `href`, `aria-labelledby`, nesting
depth), and add/repair the matching test expectations. One fixture per SURPRISING
shape: odd nesting, new post types, reply chains, error banners.
