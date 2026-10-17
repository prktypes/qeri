import {
  DEMO_LATENCY_MS,
  ExplainRequestSchema,
  createMockExplanation,
  INITIAL_PANEL_STATE,
  PANEL_STATE_STORAGE_KEY,
  isExplainRequestMessage,
  type ExplainAck,
  type ExplainRequest,
  type Explanation,
  type PanelState,
} from '@qeri/shared';

/**
 * Service worker orchestration (plan.md §Phase 1).
 *
 * Responsibilities — and deliberately nothing else:
 *   1. Validate inbound Explain messages with the shared Zod schema.
 *   2. Run the demo explainer (Phase 3 swaps this single call for the API client).
 *   3. Publish state to chrome.storage.session so the side panel always renders
 *      a coherent state machine, whichever side writes first.
 *   4. Open the side panel anchored to the requesting tab.
 *
 * CHROMIUM GOTCHA (recorded 2026-10-17): sidePanel.open() consumes the "user gesture"
 * only within the synchronous part of the message-delivery task. Any await BEFORE the
 * open() call — even a storage write — kills the gesture and Chrome throws
 * "may only be called in response to a user gesture" (see chromium issues 356181670
 * and 344767733). Therefore: the panel opens FIRST, generation happens after; the
 * panel mounts fast enough to read the 'generating' state from session storage.
 */

const LOG = (...args: unknown[]): void => console.info('[qeri:sw]', ...args);

/** Session storage helpers — the only place the storage key string is written verbatim. */
async function publishPanelState(state: PanelState): Promise<void> {
  await chrome.storage.session.set({ [PANEL_STATE_STORAGE_KEY]: state });
}

async function readPanelState(): Promise<PanelState> {
  const stored = await chrome.storage.session.get(PANEL_STATE_STORAGE_KEY);
  const raw = stored[PANEL_STATE_STORAGE_KEY];
  return typeof raw === 'object' && raw !== null && 'kind' in raw
    ? (raw as PanelState)
    : INITIAL_PANEL_STATE;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Demo "generation": deterministic mock + artificial latency to exercise loading UI. */
async function generateExplanation(request: ExplainRequest): Promise<Explanation> {
  const startedAt = Date.now();
  await sleep(DEMO_LATENCY_MS);
  const explanation = createMockExplanation(request);
  explanation.meta.generationMs = Date.now() - startedAt;
  return explanation;
}

/**
 * Opens the side panel for a tab. Returns true when opened, false when Chrome
 * blocked it (gesture restrictions). Never throws: when the automatic open is
 * blocked, a toolbar badge nudges the user to the reliable open paths
 * (toolbar icon / Alt+Q) — the explanation is safe in session storage either way.
 */
async function openPanelForTab(tabId: number | undefined): Promise<boolean> {
  try {
    let target = tabId;
    if (target === undefined) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      target = tab?.id;
      if (target === undefined) return false;
    }
    await chrome.sidePanel.open({ tabId: target });
    void chrome.action.setBadgeText({ text: '' }).catch(() => {});
    return true;
  } catch (error: unknown) {
    LOG('panel could not open automatically — use the toolbar icon or Alt+Q:', error);
    void chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' }).catch(() => {});
    void chrome.action.setBadgeText({ text: '1' }).catch(() => {});
    return false;
  }
}

async function handleExplainRequest(
  payload: unknown,
  respond: (ack: ExplainAck) => void,
): Promise<void> {
  const parsed = ExplainRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request.';
    LOG('request rejected:', message);
    respond({ ok: false, error: message });
    return;
  }

  try {
    LOG('explain request validated — generating (demo mode)');
    await publishPanelState({
      kind: 'generating',
      startedAt: new Date().toISOString(),
    });

    const explanation = await generateExplanation(parsed.data);
    await publishPanelState({ kind: 'ready', explanation });

    LOG(`explanation ${explanation.id} ready in ${explanation.meta.generationMs}ms`);
    respond({ ok: true, explanationId: explanation.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Explanation failed.';
    LOG('generation failed:', message);
    await publishPanelState({ kind: 'error', message }).catch(() => {});
    respond({ ok: false, error: message });
  }
}

// ---------------------------------------------------------------------------
// Event wiring (top-level so the worker sleeps safely between events)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!isExplainRequestMessage(message)) {
    return false; // not ours — leave the channel for other listeners
  }

  // Consume the user gesture IMMEDIATELY: open() must run inside the message
  // delivery task, before any await (see the Chromium gotcha note above).
  const tabId = sender.tab?.id;
  void openPanelForTab(tabId).then((opened) => {
    LOG(`panel ${opened ? 'opened' : 'NOT opened (blocked)'} for tab ${tabId ?? '(none)'}`);
  });

  // The explanation pipeline is independent of panel visibility: state lands in
  // session storage, and the panel (open or opening) converges via onChanged.
  void handleExplainRequest(message.payload, respond);

  // Keep the message channel open — respond() fires after async work completes.
  return true;
});

// Toolbar click opens the panel via browser-handled behavior — the most reliable
// gesture path Chrome offers (works even when message-driven opens are blocked).
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
  LOG('setPanelBehavior failed:', error);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-qeri-panel') {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const opened = await openPanelForTab(tab?.id);
      LOG(`keyboard open: ${opened ? 'opened' : 'blocked'}`);
    })();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void publishPanelState(INITIAL_PANEL_STATE);
});
