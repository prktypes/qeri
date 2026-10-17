import {
  EXPLAIN_REQUEST_MSG,
  ExplainAckSchema,
  type ExplainAck,
  type ExplainRequest,
} from '@qeri/shared';

/**
 * Content-script → service-worker transport.
 *
 * `chrome.runtime.sendMessage` resolves when the worker calls sendResponse, which is
 * why the worker listener returns true and always responds — a dangling promise here
 * would leave the chip flashing "loading" forever on some failure modes.
 */
export async function requestExplanation(request: ExplainRequest): Promise<ExplainAck> {
  try {
    const response: unknown = await chrome.runtime.sendMessage({
      type: EXPLAIN_REQUEST_MSG,
      payload: request,
    });
    const ack = ExplainAckSchema.safeParse(response);
    if (ack.success) return ack.data;

    // The worker failed to acknowledge coherently — surface a deterministic error
    // to the UI instead of showing infinite loading.
    return { ok: false, error: 'Service worker returned an unexpected response.' };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown transport error';
    return { ok: false, error: `Could not reach Qeri service worker: ${detail}` };
  }
}
