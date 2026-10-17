# Qeri

> **AI that explains what you read.** A Chrome extension that adds a lightweight
> “understanding layer” while you browse — click **Explain** on any supported post and get
> plain-English context without leaving the page.

|              |                                                                           |
| ------------ | ------------------------------------------------------------------------- |
| Status       | ✅ Phase 0–1 built — extension foundation, **demo mode** (no live AI yet) |
| Target sites | X (x.com / twitter.com), more via adapters                                |
| Stack        | TypeScript · React 19 · Vite · CRXJS · Tailwind v4 · Chrome MV3           |
| Docs         | Full roadmap + engineering log: [`plan.md`](./plan.md)                    |

## Architecture

```
X post ──► content script (✦ Explain chip, shadow DOM)
              │  chrome.runtime.sendMessage
              ▼
         service worker ──► opens side panel, writes panel state
              │             (Phase 3+: quota/auth/cache → Supabase Edge Function)
              ▼                                  │
         side panel (React) ◄──────────  OpenRouter model
```

- **Adapter isolation**: site-specific extraction lives in one module, so supporting a
  new website never touches the explanation engine.
- **Contract-first**: request/response schemas are Zod-defined in `packages/shared` and
  shared across every boundary.
- **Verify after changes**: `docs/manual-qa-phase-1.md` is the two-minute manual check.

## Getting started

```bash
pnpm install              # corepack enable first if you don't have pnpm
pnpm build:ext            # produces apps/extension/dist
```

Load in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `apps/extension/dist`.

Then open <https://x.com/home>, hit the **✦ Explain** chip on any post, and the Qeri
side panel opens with a demo explanation (real AI arrives in Phase 3).

### Development

```bash
pnpm dev:ext              # Vite dev server with extension hot-reload
pnpm lint                 # ESLint
pnpm format:check         # Prettier
pnpm typecheck            # tsc --noEmit for the whole workspace
pnpm test                 # Vitest
```

## Repository layout

```
apps/extension        # Chrome extension (Manifest V3)
packages/shared       # Zod schemas + shared logic (the API contract)
docs/                 # QA checklists and phase notes
plan.md               # Build plan & engineering log — start here
```

## Permissions, plainly

- `storage` — remember panel state while browsing (session storage only).
- `sidePanel` — open the reading panel.
- Content scripts on `x.com` / `twitter.com` only — no `<all_urls>`.

No Analytics. No trackers. No external requests in demo mode.
