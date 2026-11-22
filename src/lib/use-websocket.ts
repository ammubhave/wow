// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import type {Options} from "react-use-websocket/dist/lib/types";
import {useWebSocket as useWebSocketBase} from "react-use-websocket/dist/lib/use-websocket";

/**
 * react-use-websocket, reconnecting with backoff for as long as it takes, and with its
 * `instanceof WebSocket` check off. Some browser extensions replace
 * `window.WebSocket`, which made that check throw an empty `Error` right after the socket opened,
 * leaving it without listeners: realtime updates silently stopped for those people.
 */
export function useWebSocket<T = unknown>(
  url: string | (() => string | Promise<string>) | null,
  options: Options = {},
  connect = true
) {
  return useWebSocketBase<T>(
    url,
    {skipAssert: true, reconnectAttempts: Infinity, reconnectInterval, ...options},
    connect
  );
}

/**
 * Milliseconds before reconnect attempt `attempt` (from 0; it resets once connected): 1s, 2s, 4s…
 * up to 30s, each randomly 50–150% of that. The library's default (every 5s, giving up after 20
 * tries) had every client retry in lockstep after a deploy, and stop for good after ~100s.
 */
function reconnectInterval(attempt: number) {
  return Math.min(30_000, 1000 * 2 ** attempt) * (0.5 + Math.random());
}
