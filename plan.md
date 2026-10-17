# Qeri — Build Plan & Engineering Log

> **Qeri** = _AI that explains what you read_ — a browser extension that adds a lightweight
> “understanding layer” on top of the web. The reader stays on the page, clicks **Explain**
> on any supported post, and gets a plain-English explanation without switching tabs.
>
> This document is the **single source of truth** for what we are building, how we build it,
> and _why every technology was chosen_. It is updated after every build phase.
> Formal decisions in force:

| #   | Decision                     | Value                                                                 |
| --- | ---------------------------- | --------------------------------------------------------------------- |
| 1   | AI provider                  | **OpenRouter** (model-agnostic, OpenAI-compatible structured output)  |
| 2   | Backend                      | **Supabase** (Edge Function + Postgres + Auth)                        |
| 3   | First supported site         | **X (x.com / twitter.com)** — extractor is an isolated adapter        |
| 4   | Extension stack              | TypeScript + React + Vite + **CRXJS** + Tailwind v4, Manifest V3      |
| 5   | Package manager              | **pnpm** (workspaces/shared lockfile: one install per monorepo)       |
| 6   | Name/background on the panel | **Demo mode** — AI responses are mocked until Phase 3                 |
| 7   | Extension bundle safety      | AI key and Supabase token are **never safe** — only the Edge Function |
| 8   | Contracts are typed          | Zod schemas live in `packages/shared` — one source of truth           |

## What we are building, in one page

The snapshot a user sees while scrolling X:

```
┌──────────────────────────────────────────────────────┐
│  1. Reader is scrolling X                            │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Post text (“Higher rates compress              │ │
│  │   startup valuations…”)         [✦ Explain]     │ │   ← injected chip (content script)
│  └─────────────────────────────────────────────────┘ │
│              │ click                                 │
│              ▼                                       │
│  2. Side panel opens, showing a structured view:    │
│       • In simple terms                              │
│       • Why it matters                               │
│       • Key terms                                    │
│       • Real-world example                           │
│       • Follow-ups                                   │
└──────────────────────────────────────────────────────┘
```

The click follows this pipeline (v1 scope — no navigation, no page leave):

```
[content script]  post click → extract minimal text      (or keyboard: user invokes panel)
       │           (message passed to service worker)
       ▼
[service worker]  → Chrome sidePanel.open()             (panel is Chrome UI, not a hosted tab)
       ▼
[supabase edge function /explain]                        (Plans: quota cache auth — NOT YET)
       ▼
[OpenRouter (model)]                                     (structured JSON response)
       ▼
[side panel renders structured explanation]
```

## Architecture — why components are separated

The single most important non-UI architectural rule is **adapter isolation**:

```
packages/shared          → pure logic and types: schemas, prompts, cache hashing, config
apps/extension/
  content/adapters/x.ts  → X-specific: selectors, extraction, presence heuristics
  background/            → orchestrates messages, panel state, and future API calls
  sidepanel/             → renders *schema-shaped data* — has zero knowledge of X
supabase/functions/      → thin HTTP layer: validate → authenticate → cache → model
```

Why it matters: X changes its DOM frequently. When that happens, only `adapters/x.ts`
should need edits. The explanation engine, renderer, and backend never break because of a
changed class name on x.com.

## Package layout (planned snapshot)

```
qeri/
├── apps/
│   ├── extension/            # the only deployable app in v1
│   │   ├── manifest.ts       # single source of truth for MV3 metadata
│   │   ├── src/
│   │   │   ├── adapters/     # e.g. x.ts — website-specific extraction
│   │   │   ├── background/   # service worker: panel state + Phase 3 API calls
│   │   │   ├── content/      # content script: observe feed → decorate → Explain
│   │   │   └── panel/        # side panel (React + Tailwind)
│   │   └── vite.config.ts
│   └── web/                  # landing page (Phase 8 — not in v1)
├── packages/shared/          # zod schemas, types, prompt, cache key logic
├── supabase/
│   ├── functions/explain/    # Phase 3: HTTP endpoint, quotas, caching
│   └── migrations/           # Phase 4: SQL schema + row-level security
├── tests/
│   ├── fixtures/             # captured X HTML — the “API-calling” regression suite
│   └── unit/
├── plan.md                   # this file
└── README.md
```

## Roadmap

| Phase | Title                                   | Deliverable                                         | Status |
| ----- | --------------------------------------- | --------------------------------------------------- | ------ |
| 0     | Repo & tooling scaffolding              | Clean CI-ready monorepo; extension builds           | 🚧     |
| 1     | Extension foundation (MV3 + side panel) | Explain chip injects; panel shows **demo** response | 🚧     |
| 2     | X extraction engine                     | Robust post detection + fixtures + tests            | ⬜     |
| 3     | AI explanation engine (OpenRouter)      | Real structured explanations; quota cache           | ⬜     |
| 4     | Accounts & saved knowledge (Supabase)   | Save + history, row-level security                  | ⬜     |
| 5     | Reliability, privacy, security          | Rate limits, injection hardening, a11y, Sentry      | ⬜     |
| 6     | Private beta polish                     | Real fixes from testers                             | ⬜     |
| 7     | Web store launch                        | Listing assets, privacy policy, review-safe builds  | ⬜     |
| 8     | Post-launch: next sites, analytics      | articles/other extracts, cost dashboard             | ⬜     |

### Welcome to the repo (first commit only)

```bash
git clone https://github.com/prktypes/qeri.git
cd qeri

# 1. Enable the package manager (pnpm):
corepack enable
# 2. Install workspace dependencies:
pnpm install

# 3. Build the extension (creates apps/extension/dist):
pnpm --filter qeri-extension build

# 4. Load in Chrome:
#    chrome://extensions → enable “Developer mode” → Load unpacked
#    → select apps/extension/dist
```

## Running instructions (updated per phase)

### After Phase 0–1 (this session)

**See the demo end-to-end:**

1. Build and load the extension (see “Welcome” above). Demo mode notices will show on the
   side panel.
2. Go to <https://x.com/home>.
3. Confirm each feed post gets a small ✦ **Explain** chip.
4. Click **Explain** → the Qeri panel opens on the right in “demo mode”, feeding a canned
   but realistic explanation that _mirrors the schema_ used by the real AI in Phase 3.
5. Alt+Q (or the toolbar button) opens the panel at any time.
6. `pnpm --filter qeri-extension test:watch` for continuous testing; run `pnpm --filter
qeri-extension lint` before you commit.

**Development loop (hot reload):**

```bash
pnpm --filter qeri-extension dev
# Vite + CRXJS will instruct Chrome to pick up content scripts and the panel instantly —
# keep `dist/` loaded as the unpacked extension and edits will live-sync.
```

## Phase 0 & 1 — what this session built

### Concepts (explained simply)

Every heading below is a _concept_ implemented in this session, in implementation order.

#### Monorepo (one repo for everything)

Rather than “one repo per small service”, everything lives in one repository:

- `apps/extension` — the Chrome extension (the only user-facing deliverable in v1).
- `packages/shared` — TypeScript/Zod code imported by both extension and backend.

Benefit: the request/response contract lives in one place, so when a field changes, the
compiler flags every spoken consumer. This is the root mechanism that keeps the
_CMV client_ and `_openrouter` glue in sync without duplicate types.

#### pnpm workspaces

`pnpm-workspace.yaml` declares packages (`apps/*`, `packages/*`), so each folder is a
real npm package (`@qeri/shared`) and can be imported with a normal name — the
workspace wiring is handled completely by pnpm: one lockfile, one install,
no copy-and-paste between packages.

#### Manifest V3 (the extension’s constitution)

Chrome only allowsées extensions that declare **what they can touch**: from a
`manifest.json` (built by `apps/extension/manifest.ts`):

- `permissions` = scope, declared _explicitly_ — `["storage", "sidePanel"]` only so far.
- `content_scripts` = code that runs in the page, matched by URL — we match
  `x.com`/`twitter.com` only.
- `background` = durable logic (our service worker).
- `side_panel` = Chrome’s official side-docked UI surface (Chrome ≥114).
- `action` = toolbar button — we open the side panel on click (no popup in v1),
  plus a **Alt+Q** shortcut.

> **Restriction we set (security)**: no broad host permissions. Adding more later should
> only happen when a new “site adapter” actually ships, never in bulk.

#### CRXJS + Vite (tooling)

Writing extensions by hand means maintaining `manifest.json` + hand-rolled entries that
reference built files. **CRXJS** reads `manifest.ts`, understands which entry points it
declares (service worker, content scripts, side panel page), and wires Vite to bundle
them — including hashed asset URLs, typed entry references, and dev-mode hot reload.
React + Tailwind therefore work naturally inside an extension, not just web pages.

#### Shadow DOM (style isolation for the content script)

The Explain chip is injected into _X’s own page_. If we styled it with global CSS,
it would fight with X’s styles (and vice versa — e.g. Tailwind’s CSS reset would leak
into X). Instead:

- The extension creates a **shadow root** on the DOM node we insert.
- Styles inside the shadow root cannot affect the page; page styles cannot affect our
  node.
- Tailwind is used **only** in our own documents (side panel/popup background pages),
  which are separate pages from X — no resets leak into the site.

#### Service worker (the MV3 background)

In MV3 the background is an **event-driven service worker** — long-lived, but still
goes cold for long-running work. We:

- register the panel-on-click behavior at startup (`chrome.sidePanel.setPanelBehavior`);
- listen for two lightweight signals: the **Explain** message from the content script and
  the **Alt+Q** command, then open the side panel for that tab.

It does **not** host the AI call itself — that happens through the backend (Phase 3+),
keeping the extension bundle credential-free.

#### Chrome messaging & `chrome.storage.session` (transport state)

The content script can’t directly set side-panel state, so passing state through a
storage area shared by the worker and the panel is cleanest. We use
`chrome.storage.session` — free, ephemeral (cleared when the browser restarts).

We deliberately choose a **discriminated-union state shape**
(`{ kind: 'generating' \| 'ready' \| 'error', explanation? }`), so the panel can render
every state as a valid exhaustive switch, and _no state possible can be missing keys_
— invalid keys can’t be stored because the same Zod schema re-validates anything that
goes into the store.

#### MutationObserver (finding posts while the feed grows)

X is an **infinite scroll** app. We don’t want bulky polling; instead:

- One `MutationObserver` on the document’s `childList` and `subtree` that reacts while
  the feed updates (new cards, DOM virtualization) as nodes appear.
- We deduplicate per-article processing using a **`WeakSet`** — if a post that was
  already decorated is re-processed, we just skip it (the WeakSet falls out of memory
  with the element, so removing a post doesn’t leak).
- Two phases: `attachExistingPosts()` catches posts present at load time, then
  `observePosts()` catches anything that appears later.

#### “Explain” chip (the trigger)

Per article, we insert a small, `aria-label`ed “✦ Explain” anchor; we attach it _at
interactive points that the user can’t reach with a hover on X itself_ — by default at
the right side of the action bar. The click is async — Chrome’s
`chrome.runtime.sendMessage` sends a message, and errors are surfaced with a short
inline status instead of a blocking alert.

#### Side panel (the reading surface)

Chrome’s side panel is a regular web page with access to extension APIs, so our panel is:

- **React 19 + Tailwind v4** — the modern stack (dark mode via `prefers-color-scheme`).
- Stateless about _how the post was obtained_: it renders `Explanation` structs only.
- Shows every branch of the state machine: header → post preview → loading skeleton →
  structured sections → error + follow-up place-holders (real Phase 3 wiring).

#### Demo mode (why the AI answers look fake — on purpose)

Before an OpenRouter/Supabase key exists, the service worker produces an explanation by
running a **deterministic local mock** in `packages/shared`:

- The **schema is identical** to the real response schema (this is what makes it possible
  to build the entire UI, messaging, and storage flow against reality, and swap the
  generator, not the flow, when the AI is wired).
- A intentional latency delay is added (`demo_latencies.ts`), exercising the loading
  skeleton; the result is validated by Zod to guarantee the model comes back with
  schema-shaped data.

This keeps the next phase a **drop-in swap** — dragging real AI in does not change the
UI, storage, or message flow.

#### Contract-first typing with Zod

All payloads that cross boundaries (content → worker, worker → panel, later client →
backend) have schemas in `packages/shared`. TypeScript types are _derived_
(`z.infer<typeof X>`), so there is never a drift between “shape as documented” and
“shape as enforced”.

#### CI (GitHub Actions)

`.github/workflows/ci.yml` runs on every push/pull request:

1. install pnpm → frozen install (`--frozen-lockfile`),
2. `prettier --check .`, `eslint .`, `tsc -p apps --noEmit`, `vitest run`,
3. `vite build` the extension and upload `dist/` as an artifact.

#### Why aliases like `@qeri/shared`

Path aliases keep imports stable even when folder depth changes and mirror the npm
name — the same import works in the extension and any future backend.

## Data contracts (v1)

### `ExplainRequest` — content script → service worker → API

```jsonc
{
  "text": "Higher interest rates are compressing startup valuations.",
  "authorHandle": "@jane_doe", // canonical handle (we prepend nothing)
  "overrideStatusId": null, // optional status hash for later pagination
  "sourceUrl": "https://x.com/jane_doe/status/123",
}
```

### `Explanation` — what the UI renders (demo or AI, same shape)

```jsonc
{
  "id": "explanation:1",
  "createdAt": "2026-10-16T01:23:45.678Z",
  "mode": "simple",
  "language": "en",
  "summary": "…",
  "whyItMatters": "…",
  "keyTerms": [{ "term": "…", "definition": "…" }],
  "practicalExample": "…",
  "caveats": ["…"],
  "followUps": ["…"],
}
```

### `PanelState` — service worker → side panel through `chrome.storage.session`

```jsonc
{ "kind": "generating" }
{ "kind": "ready",     "explanation": { … } }
{ "kind": "error",     "message": "…" }
```

## Security & privacy principles enforced from day one

1. **Minimal permissions.** We declare only what we use today (`storage`, `sidePanel`,
   content scripts on x.com/twitter.com). We never pre-request future capability.
2. **No credentials in the extension.** In v1 the SW only touches Chrome APIs, so there
   is nothing to leak. When Supabase/OpenRouter integration lands, its keys live in the
   Edge Function, never in the bundle.
3. **The page is untrusted.** Every word that cross the extension boundary is passed
   through Zod schemas with size/shape limits, and the extraction adapter strips handlers
   and links — nothing from the page is executed, interpreted as an instruction, or
   stored in the persistence layer without validation.
4. **Session-only state.** `chrome.storage.session` survives HTTP restarts but clears at
   browser close — convenient for the demo; nothing “long-lived” is accumulated yet.
5. **Dark styling respects the OS**, no theme tracking code needed (Tailwind’s
   `prefers-color-scheme`), and nothing about the reader is ever logged.

## Risks while building (kids: how we handle them)

| Risk                               | Current mitigation                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| X changes selectors                | Selectors isolated in the adapter; fixture suite Phase 2                                            |
| Cyclic deps between apps           | `packages/shared` holds logic and types only — no app import searches from it                       |
| MV3 requires build pipeline tricks | CRXJS handles hashed assets and entry wiring for us                                                 |
| Accidentally shipping secrets      | `.gitignore` blocks `.env` files; CI checks built dist for `env\| Api-?submitted\|secret\|(?:API_\\ | KEY\|(\"\\\\?)` patterns |

## Next up

- **Phase 2** — fixture recording, robust X extraction (thread context, quoting,
  tabs/chromeless, small UI cards, keyboard navigation), ≥95% detection benchmark on
  real fixtures, adapter API clean enough that a second site is a new file plus manifest
  matches — never a rewrite.
- **Phase 3** — OpenRouter call pipeline + caching + quotas + demo/AI flag switch with
  fallback.

## Session log (append-only)

- 2026-10-16 — Phase 0 (repo, tooling, contracts) and Phase 1 (extension foundation,
  demo mode side panel, CI) — see concepts above.
