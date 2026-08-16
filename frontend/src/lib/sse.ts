// frontend/src/lib/sse.ts
/**
 * Minimal fetch-based Server-Sent Events reader.
 *
 * WHY NOT NATIVE EventSource: /scan/{job_id}/stream requires
 * `Authorization: Bearer <token>` (security/jwt_handler.py's
 * get_current_user reads it via OAuth2PasswordBearer). Native
 * EventSource cannot set custom request headers, so it's a non-starter
 * for this endpoint. This reads the same text/event-stream wire format
 * over fetch() + ReadableStream instead.
 *
 * WHY NO AUTO-RECONNECT: job_store's queue (services/scanner.py) is a
 * single-consumer asyncio.Queue with no event replay. A second reader
 * attaching to the same job_id would compete with the first for events
 * rather than both receiving them. A naive auto-reconnect here would risk
 * exactly that race on any network blip. Callers that need "resume
 * watching" should ensure the previous AbortController is fully aborted
 * before opening a new stream for the same job_id.
 */

export interface SSEFrame {
  event: string;
  data: string;
}

export interface SSEStreamHandlers {
  onFrame: (frame: SSEFrame) => void;
  onHeartbeat?: () => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

/**
 * Opens `url` as an SSE stream. Returns an AbortController — call
 * `.abort()` to stop reading and close the connection early.
 */
export function openEventStream(
  url: string,
  headers: Record<string, string>,
  handlers: SSEStreamHandlers
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(url, {
        headers: { ...headers, Accept: "text/event-stream" },
        signal: controller.signal,
        credentials: "include",
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line. Process every complete
        // frame in the buffer; leave a trailing partial frame for the
        // next chunk.
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const rawFrame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          processFrame(rawFrame, handlers);
        }
      }

      handlers.onClose?.();
    } catch (error) {
      // Expected outcome of controller.abort() — not a real failure.
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      handlers.onError?.(error);
    }
  })();

  return controller;
}

function processFrame(rawFrame: string, handlers: SSEStreamHandlers): void {
  const lines = rawFrame.split("\n");
  let event = "message";
  const dataLines: string[] = [];
  let isCommentOnly = true;

  for (const line of lines) {
    if (line.startsWith(":")) continue; // comment (keep-alive) line
    isCommentOnly = false;
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (isCommentOnly) {
    handlers.onHeartbeat?.();
    return;
  }

  handlers.onFrame({ event, data: dataLines.join("\n") });
}