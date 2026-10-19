import {
  LibraryAckSchema,
  LIBRARY_CLEAR_MSG,
  LIBRARY_DELETE_MSG,
  LIBRARY_SAVE_MSG,
  type Explanation,
  type LibraryAck,
  type LibraryMessage,
} from '@qeri/shared';

/**
 * Panel → service-worker library transport (plan.md §Phase 4).
 *
 * Same contract discipline as the content-script transport: validated envelope in,
 * validated ack out, bounded wait. Library ops are local and fast, but a hung worker
 * must never freeze a click, so every call resolves within 10 s.
 */

const ACK_TIMEOUT_MS = 10_000;

const ACK_FAILURE: LibraryAck = { ok: false, error: 'Qeri service worker did not respond.' };

async function send(message: LibraryMessage): Promise<LibraryAck> {
  const promise = chrome.runtime.sendMessage(message) as Promise<unknown>;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ACK_TIMEOUT_MS),
  );

  try {
    const wire = await Promise.race([promise, timeout]);
    const ack = LibraryAckSchema.safeParse(wire);
    return ack.success ? ack.data : ACK_FAILURE;
  } catch {
    return ACK_FAILURE;
  }
}

export function saveToLibrary(explanation: Explanation): Promise<LibraryAck> {
  return send({ type: LIBRARY_SAVE_MSG, payload: explanation });
}

export function deleteFromLibrary(explanationId: string): Promise<LibraryAck> {
  return send({ type: LIBRARY_DELETE_MSG, payload: { id: explanationId } });
}

export function clearLibraryViaWorker(): Promise<LibraryAck> {
  return send({ type: LIBRARY_CLEAR_MSG });
}
