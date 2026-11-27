import {BEARER_PROTOCOL} from "@/lib/extension";

import {captureServerException} from "./posthog";
import {offersBearerProtocol} from "./request-session";
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
    return withBearerProtocol(request, await handler());
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

/**
 * A socket that signed in with an access token (the Chrome extension: see getHeadersSession) offered
 * the subprotocols `[BEARER_PROTOCOL, <token>]`, and the browser only opens it if the 101 picks one
 * of them. Pick BEARER_PROTOCOL here, for every room, rather than in each Durable Object.
 */
function withBearerProtocol(request: Request, response: Response) {
  if (response.status !== 101 || !offersBearerProtocol(request.headers)) return response;
  const headers = new Headers(response.headers);
  headers.set("Sec-WebSocket-Protocol", BEARER_PROTOCOL);
  return new Response(null, {
    status: 101,
    statusText: response.statusText,
    headers,
    webSocket: response.webSocket,
  });
}
