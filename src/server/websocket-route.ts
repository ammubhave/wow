import {captureServerException} from "./posthog";
import {requireWebSocketUpgrade} from "./workspace-access";

/**
 * A GET handler for a Durable Object websocket room: rejects non-upgrade requests up front, and
 * reports what went wrong when forwarding fails. Left to TanStack Start, a throw here became a bare
 * `{"message":"HTTPError","status":500}` log line with the actual error dropped, and never reached
 * PostHog.
 */
export async function webSocketRoute(request: Request, handler: () => Promise<Response>) {
  const notUpgrade = requireWebSocketUpgrade(request);
  if (notUpgrade) return notUpgrade;
  try {
    return await handler();
  } catch (error) {
    const path = new URL(request.url).pathname;
    // The client gave up mid-handshake (navigated away, flaky network): nothing to report, and
    // nobody is left to read the response.
    if (request.signal.aborted) {
      console.warn(`WebSocket ${path}: client left before the upgrade finished`, error);
      return new Response(null, {status: 499});
    }
    console.error(`WebSocket ${path} failed`, error);
    captureServerException(error, {properties: {path}});
    return new Response(null, {status: 502});
  }
}
