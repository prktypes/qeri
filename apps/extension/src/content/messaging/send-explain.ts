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
 * why the worker listener returns true and always responds. A timeout guards the
 * remaining failure mode: a crashed/suspended worker that never responds would
 * otherwise leave the chip flashing "loading" forever.
 */

/** Upper bound on demo/AI latency before the chip gives up and offers a retry. */
const ACK_TIMEOUT_MS = 12_000;

const LOG = (...args: unknown[]): void => console.debug('[qeri:cs]', ...args);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} did not respond within ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export async function requestExplanation(request: ExplainRequest): Promise<ExplainAck> {
  LOG('sending explain request to service worker');
  try {
    const response: unknown = await withTimeout(
      chrome.runtime.sendMessage({ type: EXPLAIN_REQUEST_MSG, payload: request }),
      ACK_TIMEOUT_MS,
      'Qeri service worker',
    );
    const ack = ExplainAckSchema.safeParse(response);
    if (ack.success) return ack.data;

    // The worker failed to acknowledge coherently — surface a deterministic error
    // to the UI instead of showing infinite loading.
    LOG('unexpected ack shape:', response);
    return { ok: false, error: 'Service worker returned an unexpected response.' };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown transport error';
    LOG('transport error:', detail);
    return { ok: false, error: `Could not reach Qeri service worker: ${detail}` };
  }
}
