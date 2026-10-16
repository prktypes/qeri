import { z } from 'zod';
import { ExplanationSchema } from './explain';

/**
 * Side-panel state machine, persisted in chrome.storage.session so the panel and the
 * service worker agree no matter which one writes first (they race: opening the panel
 * is asynchronous, the state write is not).
 *
 * Exhaustive union → the React side switches over `kind` and TypeScript proves no
 * state is left unrendered.
 */
export const PanelStateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('idle') }),
  z.object({ kind: z.literal('generating'), startedAt: z.iso.datetime() }),
  z.object({ kind: z.literal('ready'), explanation: ExplanationSchema }),
  z.object({ kind: z.literal('error'), message: z.string().min(1).max(300) }),
]);
export type PanelState = z.infer<typeof PanelStateSchema>;

/** chrome.storage.session key the panel subscribes to. */
export const PANEL_STATE_STORAGE_KEY = 'qeri:panel-state';

/** Initial safe state — written once when the service worker boots. */
export const INITIAL_PANEL_STATE: PanelState = { kind: 'idle' };
