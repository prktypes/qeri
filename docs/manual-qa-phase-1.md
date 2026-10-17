# Manual QA Checklist — Phase 0–1 (demo mode)

Automated gates (`pnpm test / typecheck / lint / build:ext`) catch code regressions.
This list verifies **real-world behavior** in Chrome. Run it after every extension
change, ideally in a fresh profile.

## Setup (fresh)

- [ ] `pnpm install && pnpm build:ext` completes with no errors.
- [ ] `chrome://extensions` → Developer mode → Load unpacked → `apps/extension/dist`.
- [ ] Extension card shows **“Qeri — AI that explains what you read” 0.1.0**, no errors.

## Core loop on x.com

- [ ] Feed posts show the purple **✦ Explain** chip in the action bar.
- [ ] Clicking a chip opens the **side panel** with a loading skeleton, then a demo
      explanation with a **demo mode** badge.
- [ ] Sections render: In simple terms / Why it matters / Key terms / Example / Caveats /
      Follow-ups.
- [ ] The original post text appears quoted at the top of the explanation.
- [ ] Explaining a second post replaces the panel content.

## Feed dynamics

- [ ] Infinite scroll: newly loaded posts get chips automatically.
- [ ] No post ever shows **two** chips (scroll away, back, hard refresh, repeat).
- [ ] Quoted-post previews (posts quoting another post) get exactly one chip, on the
      outer post only.
- [ ] Page behavior unaffected: liking, replying, opening the post menu all work —
      the chip does not swallow clicks.

## Invocations

- [ ] Toolbar icon click opens the panel.
- [ ] **Alt+Q** opens the panel.

## Resilience & states

- [ ] Panel shows a proper error state if generation fails (devtools: stop the service
      worker via `chrome://extensions` while a request is in flight, then retry).
- [ ] After a failure, the chip recovers: label returns to “Explain”, clicking again works.
- [ ] First click after a long idle (cold service worker) still completes.

## Visual & accessibility

- [ ] Light and dark browser themes both render the panel correctly.
- [ ] Panel is usable at ~360px width (default Chrome side panel width).
- [ ] Chip has an accessible name (`Explain this post with Qeri`) — check via DevTools
      Accessibility pane.
- [ ] Keyboard: Tab can reach the chip (shadow root contains a real `<button>`).

## Privacy sanity

- [ ] Demo mode makes **zero** network requests from the extension — check the Network
      tab of the panel and service worker DevTools.
- [ ] Only `x.com`/`twitter.com` tabs run the content script — nothing on other sites.

## Exit criteria

All boxes checked → Phase 0–1 is verified and Phase 2 (extraction engine) may begin.
