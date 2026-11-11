// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import type {Options} from "react-use-websocket/dist/lib/types";
import {useWebSocket as useWebSocketBase} from "react-use-websocket/dist/lib/use-websocket";

/**
 * react-use-websocket, with its `instanceof WebSocket` check off. Some browser extensions replace
 * `window.WebSocket`, which made that check throw an empty `Error` right after the socket opened,
 * leaving it without listeners: realtime updates silently stopped for those people.
 */
export function useWebSocket<T = unknown>(
  url: string | (() => string | Promise<string>) | null,
  options: Options = {},
  connect = true
) {
  return useWebSocketBase<T>(url, {skipAssert: true, ...options}, connect);
}
