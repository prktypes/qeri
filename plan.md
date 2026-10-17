# Qeri — Build Plan & Engineering Log

> **Qeri** = _AI that explains what you read_ — a browser extension that adds a lightweight
> “understanding layer” on top of the web. The reader stays on the page, clicks
> **✦ Explain** on any supported post, and gets a plain-English explanation without
> switching tabs.
>
> This document is the **single source of truth** for what we are building, how we build
> it, and _why every technology was chosen_. It is updated after every build phase.

## Decisions in force

| #   | Decision             | Value                                                                     |
| --- | -------------------- | ------------------------------------------------------------------------- |
| 1   | AI provider          | **OpenRouter** (model-agnostic, OpenAI-compatible structured output)      |
| 2   | Backend              | **Supabase** (Edge Function + Postgres + Auth) — arrives Phase 3–4        |
| 3   | First supported site | **X (x.com / twitter.com)** — extraction lives in one isolated adapter    |
| 4   | Extension stack      | TypeScript 5.9 + React 19 + Vite 7 + **CRXJS 3** + Tailwind v4, MV3       |
| 5   | Package manager      | **pnpm 12** (workspaces, one lockfile, one install)                       |
| 6   | Current mode         | **Demo mode** — AI responses are mocked locally until Phase 3             |
| 7   | Bundle safety        | AI/Supabase keys live only in the Edge Function, never in the extension   |
| 8   | Contracts            | Zod schemas in `packages/shared` — one source of truth for every boundary |

## What we are building, in one page

What a reader sees while scrolling X:

```
┌──────────────────────────────────────────────────────────┐
│  1. Reader scrolls X                                     │
│  ┌─────────────────────────────────────────────────┐     │
│  │  Post text (“Higher rates compress              │     │
│  │   startup valuations…”)      [✦ Explain]        │     │  ← chip injected by content script
│  └─────────────────────────────────────────────────┘     │
│              │ click                                     │
│              ▼                                           │
│  2. Side panel opens with a structured explanation:      │
│        • In simple terms        • Why it matters         │
│        • Key terms              • Real-world example     │
│        • Caveats                • Follow-ups             │
└──────────────────────────────────────────────────────────┘
```

The click follows this pipeline (v1 scope — no navigation, no page leave):

```
[content script]   click → extract the ONE selected post → validate
       │           chrome.runtime.sendMessage (validated envelope)
       ▼
[service worker]   re-validates → writes PanelState to chrome.storage.session
       │           opens chrome.sidePanel for that tab
       ▼
[demo generator]   (Phase 1–2) local mock explanation, same schema as real AI
       │           (Phase 3+ becomes: Supabase Edge Function → OpenRouter model)
       ▼
[side panel]       subscribes to storage changes → renders exhaustive states
```

## Architecture — why components are separated

The most important non-UI architectural rule is **adapter isolation**:

```
packages/shared             → pure logic + types: schemas, constants, prompt (no DOM, no chrome.*)
apps/extension/src/
  content/adapters/         → X-specific ONLY: selectors, extraction, host detection
  content/detection/        → feed watching: MutationObserver pipeline, dedupe
  content/chip/             → the ✦ Explain chip (shadow DOM UI)
  content/messaging/        → validated transport to the service worker
  background/               → orchestration: validation, demo generation, panel state
  panel/                    → React UI: renders Explanation structs, knows nothing about X
supabase/functions/explain/ → Phase 3: validate → auth → quota → cache → model
```

Why: X changes its DOM frequently. When it does, only `content/adapters/` should need
edits — the engine, renderer, and backend never break because a class name changed on
x.com.

## Repository layout (actual, after Phase 0–1)

```
qeri/
├── apps/
│   └── extension/
│       ├── manifest.ts            # typed MV3 manifest (version from package.json)
│       ├── vite.config.ts         # CRXJS + React + Tailwind v4 pipeline
│       ├── scripts/zip-dist.mjs   # dependency-free store-artifact packer
│       └── src/
│           ├── background/service-worker.ts
│           ├── content/
│           │   ├── adapters/{environment.ts,x.ts}
│           │   ├── detection/observe-feed.ts
│           │   ├── chip/explain-chip.ts
│           │   ├── messaging/send-explain.ts
│           │   └── content-entry.ts
│           └── panel/
│               ├── index.html · main.tsx · App.tsx · styles.css
│               ├── use-panel-state.ts
│               └── components/{panel-header,logo,idle,generating,error,explanation-view}
├── packages/shared/src/
│   ├── constants.ts               # caps, defaults, schema version
│   ├── schemas/{explain,panel}.ts # Zod contracts + inferred types
│   ├── messaging/messages.ts      # envelope + ack schemas + type guard
│   ├── mocks/mock-explanation.ts  # demo-mode generator (schema-identical)
│   └── *.test.ts                  # 12 unit tests colocated
├── .github/workflows/ci.yml
├── plan.md · README.md
```

## Roadmap

| Phase | Title                                   | Deliverable                                         | Status |
| ----- | --------------------------------------- | --------------------------------------------------- | ------ |
| 0     | Repo & tooling scaffolding              | Clean CI-ready monorepo; extension builds           | ✅     |
| 1     | Extension foundation (MV3 + side panel) | Explain chip injects; panel shows **demo** response | ✅     |
| 2     | X extraction engine                     | Robust post detection + fixtures + tests            | ⬜     |
| 3     | AI explanation engine (OpenRouter)      | Real structured explanations; quota cache           | ⬜     |
| 4     | Accounts & saved knowledge (Supabase)   | Save + history, row-level security                  | ⬜     |
| 5     | Reliability, privacy, security          | Rate limits, injection hardening, a11y, Sentry      | ⬜     |
| 6     | Private beta polish                     | Real fixes from testers                             | ⬜     |
| 7     | Web store launch                        | Listing assets, privacy policy, review-safe builds  | ⬜     |
| 8     | Post-launch: next sites, analytics      | articles/other extracts, cost dashboard             | ⬜     |

---

## How to test the current version (Phase 0–1 = demo mode)

### 1. Build & install the extension

```bash
git clone https://github.com/prktypes/qeri.git
cd qeri
corepack enable    # once — gives you pnpm 12
pnpm install
pnpm build:ext     # produces apps/extension/dist
```

In Chrome: open `chrome://extensions` → enable **Developer mode** (top right) →
**Load unpacked** → select the `apps/extension/dist` folder.

### 2. Two-minute end-to-end check (the demo must do ALL of this)

| Check                                    | Expected result                                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open <https://x.com/home>                | Every feed post shows a small purple **✦ Explain** chip in its action bar                                                                                                                                      |
| Click **✦ Explain**                      | Qeri side panel opens on the right, shows a brief loading skeleton, then a structured demo explanation (summary / why it matters / key terms / example / caveats / follow-up chips) with a **demo mode** badge |
| Scroll the feed (infinite scroll)        | Newly appearing posts also get chips — no duplicates anywhere                                                                                                                                                  |
| Click **✦ Explain** on another post      | Panel content is replaced by that post's explanation                                                                                                                                                           |
| Press **Alt+Q**                          | Panel toggles open; clicking the toolbar icon does the same                                                                                                                                                    |
| Switch OS/browser theme                  | Panel follows light/dark automatically                                                                                                                                                                         |
| Click ✦ while the service worker is cold | First click may take a moment; no stuck “loading” state — chip recovers to `Retry`/`Failed` briefly on error                                                                                                   |

### 3. Where to look when something misbehaves

- **Service worker logs**: `chrome://extensions` → Qeri → _Inspect views: service worker_.
- **Panel logs**: right-click inside the open panel → _Inspect_.
- **Content-script logs**: DevTools on x.com (the console shows extension-sourced errors too).
- After reloading code: click the **reload ↻** icon on the extension card, then
  hard-refresh the x.com tab (`Ctrl+Shift+R`).

### 4. Quality gates (must all pass before any commit)

```bash
pnpm test          # 12 unit tests — schemas, messaging guard, mock generator
pnpm typecheck     # strict TS across the whole workspace
pnpm lint          # ESLint (logic); formatting is Prettier's job
pnpm format:check  # Prettier
pnpm build:ext     # the real gate — Vite must bundle all entry points
pnpm zip:ext       # → apps/extension/qeri-extension.zip (store artifact, verified zip)
```

### 5. Known limitations after Phase 0–1 (deliberate scope cuts)

- Explanation content is **demo copy** — it proves the pipeline; real AI arrives Phase 3.
- Follow-up chips are static placeholders until the AI integration.
- Some embedded post layouts without a reachable action bar get no chip yet.
- No persistence, accounts, or network calls yet — by design (privacy-first default).

### Troubleshooting: “nothing happens when I click Explain”

Diagnose in this exact order — each symptom names the broken link:

1. **Chip click never logs** — page DevTools console shows no `[qeri:cs] explain clicked`:
   the content script is stale. Reload the extension (↻ on `chrome://extensions`) and
   hard-refresh the X tab (`Ctrl+Shift+R`). Content scripts only inject on page loads
   that happen _after_ install/reload.
2. **Click logs, but the service worker console shows nothing** — the worker is dead:
   open `chrome://extensions` → Qeri → _Inspect views: service worker_ and look for a
   boot error. Then click a chip again.
3. **SW logs `panel could not open automatically`** — Chrome's gesture restriction
   blocked the automatic open (see the Chromium gotcha lesson below). The explanation is
   still generated: a **purple `1` badge** appears on the toolbar icon — click it (or
   press **Alt+Q**) and the panel shows the ready explanation.
4. **Panel opens but shows “Nothing explained yet”** — panel console
   (right-click in panel → _Inspect_) should log `state change → ready`. If it warns
   `rejected malformed panel state`, send the logged object to engineering.
5. **Chip shows `Failed`** — transport error; the ack text in the page console names it.

### Engineering lesson: Chromium gesture scope for `sidePanel.open()`

`chrome.sidePanel.open()` consumes a “user gesture”, and gesture state from a content
script click only survives into the **synchronous part of the service worker’s
onMessage task** (chromium issues 356181670 / 344767733). Any `await` before `open()` —
even a storage write — silently destroys it. Qeri therefore:

- opens the panel at the very top of the message handler, before any await;
- generates the explanation afterwards (the panel mounts and reads state from session
  storage — the ordering is safe because the panel both reads on mount and subscribes
  to `onChanged`);
- falls back to a toolbar badge (`1`) + `setPanelBehavior`-handled toolbar clicks and
  the Alt+Q command, which are always-trusted gesture paths.

---

## Phase 0 & 1 — what was built and why (concepts, in implementation order)

### Monorepo (one repo for everything)

Instead of one repo per service, everything lives together:

- `apps/extension` — the Chrome extension (the only user-facing deliverable in v1).
- `packages/shared` — TypeScript/Zod code imported by both extension and future backend.

Benefit: the request/response contract lives in one place, so when a field changes, the
compiler flags every consumer. This keeps the extension and the future OpenRouter glue
in sync without duplicate types.

### pnpm workspaces

`pnpm-workspace.yaml` registers `apps/*` and `packages/*` as workspace members, so each
folder is a real package (`@qeri/shared`) importable by name. One lockfile, one install,
no copy-paste between packages. pnpm 12 blocks lifecycle scripts by default — the only
approved one is `esbuild`'s platform-binary check (supply-chain hygiene).

### Manifest V3 (the extension's constitution)

Chrome only lets an extension do what `manifest.json` declares. Ours (built from
`apps/extension/manifest.ts`, typed, version pulled from `package.json`):

- `permissions: ["storage", "sidePanel"]` — nothing more, declared explicitly.
- `content_scripts` — run only on `x.com` / `twitter.com` (legacy host included).
- `background` — the service worker (durable logic, no AI keys ever).
- `side_panel` — Chrome's official side-docked UI surface (Chrome ≥116).
- `action` — toolbar icon opens the panel (no popup in v1: the product's job is
  “read where you are”, configuration comes later).
- `commands` — **Alt+Q** opens the panel from the keyboard.

> **Security stance:** no broad host permissions, ever. New permissions ship only when a
> new feature actually needs them — never pre-declared.

### CRXJS + Vite (the build pipeline)

Hand-maintaining `manifest.json` with built-file references is error-prone. **CRXJS**
reads `manifest.ts`, turns every declared entry point (service worker, content script,
side panel page) into Vite inputs, rewrites the manifest to point at hashed output
files, and gives dev-mode hot reload. React + Tailwind therefore work naturally inside
an extension.

> **Version lesson learned (recorded for the future):** Vite 8 switched to the rolldown
> bundler and dropped the esbuild plumbing CRXJS 3 relies on
> (`transformWithEsbuild` requires a separate esbuild install there). We pinned
> **Vite 7.3.x + @vitejs/plugin-react 5.x + CRXJS 3.0** — the combination that is
> actually supported. Revisit when CRXJS ships a rolldown-native release.

### Shadow DOM (style isolation for the injected chip)

The ✦ Explain chip is injected into **X's own page**. Global CSS would fight X's
styles (and a Tailwind reset would nuke the site). So the chip lives in a **closed
shadow root**:

- styles inside the root cannot leak out; page styles cannot leak in;
- `mode: 'closed'` keeps page scripts from walking into our internals;
- the chip is the ONLY DOM node we add to the host page;
- Tailwind is used exclusively in our own documents (the side panel), never on the page.

### Content script + MutationObserver (finding posts in an infinite feed)

X virtualizes its feed — posts appear, mutate, and get evicted as you scroll. We never
poll; a single `MutationObserver` on the document reacts to `childList`/`subtree`
mutations. Bursts are coalesced into one batch per animation frame. Two boot phases:

1. `attachExistingPosts()` — decorates what's already in the DOM at script start;
2. `observeFeed()` — decorates everything that appears later.

A **`WeakSet`** marks processed articles: re-scrolls and hydration replacements can
never double-inject a chip, and garbage collection is automatic when X evicts posts.

### The extraction adapter (turning DOM into a validated request)

`content/adapters/x.ts` is the only module that knows X's DOM:

- `[data-testid="tweet"]` — the article element; `[data-testid="tweetText"]` — text;
- permalink anchor `a[href*="/status/"]` → canonical `https://x.com/<user>/status/<id>`
  (legacy twitter.com hosts are normalized), giving `statusId` for free;
- quoted-preview articles nested inside another article are skipped — we explain the
  post you see, not its quote;
- whitespace is normalized and text is truncated at the shared 4,000-char cap;
- output is an `ExplainRequest` validated by Zod before it ever crosses a boundary.

### Service worker (orchestration only)

MV3's background is an event-driven service worker. Ours:

- re-validates every inbound message with the shared schema (never trusts runtime data);
- writes an **exhaustive `PanelState` union** to `chrome.storage.session`
  (`idle | generating | ready | error`) — the panel renders exactly these states;
- runs the **demo generator** with artificial latency (`DEMO_LATENCY_MS = 450`) so the
  loading skeleton is exercised end-to-end;
- opens the side panel for the requesting tab (falls back to the focused tab);
- handles the **Alt+Q** command and the toolbar click.

It does **not** host AI calls — that's the backend's job from Phase 3, keeping the
extension bundle credential-free.

### Side panel (the reading surface)

The side panel is a regular web page with extension-API access: **React 19 + Tailwind
v4**, dark mode via `prefers-color-scheme`. It is stateless about _how_ a post was
obtained — it renders `Explanation` structs only. `usePanelState()` reads the state
machine once on mount, then tracks `chrome.storage.onChanged`. The App switches
exhaustively over the union — adding a new `kind` to the schema becomes a compile error
until the UI renders it. Idle state teaches the 3-step flow; generating state shows a
branded skeleton; error state shows the reason and a recovery hint.

### Demo mode (why explanations look canned — on purpose)

Until an OpenRouter key exists, the service worker produces explanations via a
**deterministic local mock** in `packages/shared`:

- the returned object satisfies the **exact real `Explanation` schema** (validated by
  the same Zod schemas in tests);
- it never fabricates subject-matter claims — copy describes the pipeline and flags
  itself as demo content in `caveats`;
- Phase 3 swaps the generator function, not the flow: UI, storage, and messaging are
  unchanged when real AI lands.

### Contract-first typing with Zod

Every payload that crosses a boundary (content → worker, worker → panel, later client →
backend) has a schema in `packages/shared`. TypeScript types are **derived**
(`z.infer<typeof ...>`), so documented shape and enforced shape can never drift. Even
the message envelope and the ack are unions with a runtime type guard.

### Packaging & CI

- `pnpm zip:ext` runs a zero-dependency packer (`scripts/zip-dist.mjs`) that walks
  `dist/` and emits a correct zip (CRC32, UTF-8 names) — the same artifact the Chrome
  Web Store receives in Phase 7.
- `.github/workflows/ci.yml` runs on every push/PR: pnpm frozen install → Prettier
  check → ESLint → typecheck → Vitest → `vite build` → uploads `dist/` as artifact.

### Why the `@qeri/shared` import works everywhere

The extension's Vite config aliases `@qeri/shared` to the shared package's **source**
(`packages/shared/src/index.ts`), so shared code is bundled from source with full
typechecking — no build step for the library, no duplicate zod copies, and HMR applies
to shared code during development.

---

## Data contracts (v1)

### `ExplainRequest` — content script → service worker → (Phase 3) API

```jsonc
{
  "text": "Higher interest rates are compressing startup valuations.",
  "authorHandle": "@jane_doe",
  "sourceUrl": "https://x.com/jane_doe/status/123",
  "statusId": "123",
  "mode": "simple", // quick | simple | deep
  "language": "en",
}
```

### `Explanation` — what the UI renders (demo or AI, same shape)

```jsonc
{
  "id": "mock-x7y2-qeri",
  "createdAt": "2026-10-17T01:23:45.678Z",
  "request": { "…": "the ExplainRequest that produced this" },
  "summary": "…",
  "whyItMatters": "…",
  "keyTerms": [{ "term": "…", "definition": "…" }],
  "example": "…",
  "caveats": ["…"],
  "followUps": ["…"],
  "meta": {
    "generator": "mock",
    "model": null,
    "cached": false,
    "generationMs": 452,
    "schemaVersion": "0.1.0",
  },
}
```

### `PanelState` — service worker → side panel via `chrome.storage.session`

```jsonc
{ "kind": "idle" }
{ "kind": "generating", "startedAt": "2026-10-17T01:23:45.678Z" }
{ "kind": "ready",      "explanation": { … } }
{ "kind": "error",      "message": "…" }
```

### Message envelope — content script → worker (with ack)

```jsonc
// request
{ "type": "qeri/explain-request", "payload": { "…": "ExplainRequest" } }
// ack (worker → chip)
{ "ok": true,  "explanationId": "mock-x7y2-qeri" }
{ "ok": false, "error": "text: Post text is required" }
```

## Security & privacy principles enforced from day one

1. **Minimal permissions** — `storage` + `sidePanel` only; content scripts on
   x.com/twitter.com. No `<all_urls>`, no host-wide grants.
2. **No credentials in the extension** — the SW touches only Chrome APIs today; when
   Supabase/OpenRouter arrive, keys live in the Edge Function, never in the bundle.
3. **The page is untrusted** — every word crossing a boundary is Zod-validated with
   size/shape caps; nothing from the page is executed, followed as an instruction, or
   persisted without validation.
4. **Session-only state** — `chrome.storage.session` clears when the browser closes;
   nothing long-lived accumulates yet.
5. **Zero network in demo mode** — the panel makes no external requests; even fonts and
   icons are inline/local.

## Risks while building and how we handle them

| Risk                                  | Mitigation                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| X changes its DOM selectors           | Selectors isolated in `adapters/x.ts`; Phase 2 adds a recorded-fixture suite             |
| Build tooling drift (CRXJS/Vite)      | Pinned Vite 7 + CRXJS 3 combo; lesson recorded above                                     |
| Secret leakage                        | `.gitignore` blocks `.env*`; keys will live server-side only (Phase 3)                   |
| Duplicate chip injection on re-scroll | WeakSet dedupe + idempotent decorate + batch-per-frame observer                          |
| Stuck loading states                  | Validated ack contract; chip auto-recovers to Retry/Failed and panel has an error branch |

## Next up

- **Phase 2 — X extraction engine**: record 10–20 real post HTML fixtures into
  `tests/fixtures/`; extractor unit tests against them (≥95% detection on the set);
  thread context (parent posts), quoted-post references, alt-text handling; adapter
  interface formalized so a second site is “new file + new manifest match”.
- **Phase 3 — AI engine**: Supabase Edge Function `/explain` (validate → auth → quota →
  cache by content hash + prompt/model version → OpenRouter structured output →
  re-validate server-side), quality set of 50–100 posts, cost/usage tracking.

## Session log (append-only)

- **2026-10-16 / 17 — Phase 0 + 1 complete.** Monorepo scaffolded (pnpm 12, strict TS,
  ESLint 10 + Prettier 3, Vitest 5); extension pipeline pinned to Vite 7 + CRXJS 3 after
  discovering Vite 8's rolldown core breaks CRXJS (lesson recorded above). Contracts
  implemented (`ExplainRequest`, `Explanation`, `PanelState`, message envelope + ack)
  with 12 passing unit tests. X adapter (host detection, extraction, quote-skip,
  canonical permalinks), feed observer (batched MutationObserver + WeakSet dedupe),
  Explain chip (closed shadow DOM, 3 visual states), service worker (validation, demo
  generation with artificial latency, session-storage state machine, panel opening via
  message/command/toolbar), React 19 + Tailwind v4 side panel (exhaustive state
  rendering), dependency-free zip packer, GitHub Actions CI. All gates green: build ✅
  tests 12/12 ✅ typecheck ✅ lint ✅ zip ✅.
- **2026-10-17 — field bug: “nothing happens on Explain”.** Root cause: the service
  worker called `sidePanel.open()` after awaits (storage writes + demo latency), which
  destroys the user-gesture scope (chromium 356181670/344767733) — the panel silently
  never opened while the explanation was generated into storage. Fix: panel opens
  synchronously at message entry; generation happens after; blocked opens fall back to
  a toolbar badge; `setPanelBehavior` + Alt+Q give always-reliable paths. Chip transport
  gained a 12s ack timeout (can never stick on loading); structured `[qeri:sw]` /
  `[qeri:cs]` / `[qeri:panel]` console logging shipped for field diagnosis.
  Troubleshooting guide added to this document.
