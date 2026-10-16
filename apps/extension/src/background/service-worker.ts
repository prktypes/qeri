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
 *      a coherent state machine, whichever side wrote first.
 *   4. Open the side panel anchored to the requesting tab.
 */

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

async function handleExplainRequest(
  rawMessage: unknown,
  senderTabId: number | undefined,
  respond: (ack: ExplainAck) => void,
): Promise<void> {
  if (!isExplainRequestMessage(rawMessage)) {
    respond({ ok: false, error: 'Malformed message envelope.' });
    return;
  }

  const request = ExplainRequestSchema.safeParse(rawMessage.payload);
  if (!request.success) {
    const first = request.error.issues[0];
    respond({
      ok: false,
      error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request.',
    });
    return;
  }

  try {
    await publishPanelState({
      kind: 'generating',
      startedAt: new Date().toISOString(),
    });

    const explanation = await generateExplanation(request.data);
    await publishPanelState({ kind: 'ready', explanation });

    await openPanelForTab(senderTabId);

    respond({ ok: true, explanationId: explanation.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Explanation failed.';
    await publishPanelState({ kind: 'error', message });
    await openPanelForTab(senderTabId);
    respond({ ok: false, error: message });
  }
}

async function openPanelForTab(tabId: number | undefined): Promise<void> {
  if (tabId === undefined) {
    // No tab context (rare: invoked from devtools) — fall back to the focused window.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
    return;
  }
  // Tolerate benign re-open errors (panel already open for that tab).
  try {
    await chrome.sidePanel.open({ tabId });
  } catch {
    /* panel already visible */
  }
}

// ---------------------------------------------------------------------------
// Event wiring (top-level so the worker sleeps safely between events)
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  void handleExplainRequest(message, sender.tab?.id, respond);
  // Keep the message channel open — respond() fires after async work completes.
  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-qeri-panel') {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined) await openPanelForTab(tab.id);
    })();
  }
});

// Toolbar click opens the panel for the focused tab (no popup in v1 — plan.md §MV3).
chrome.action.onClicked.addListener((tab) => {
  void openPanelForTab(tab.id);
});

chrome.runtime.onInstalled.addListener(() => {
  void publishPanelState(INITIAL_PANEL_STATE);
});

void readPanelState().then((state) => {
  void publishPanelState(state.kind === 'idle' ? INITIAL_PANEL_STATE : state);
});
