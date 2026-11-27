import {useCallback, useEffect, useMemo} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {ReadyState} from "react-use-websocket/dist/lib/constants";
import {sharedWebSockets} from "react-use-websocket/dist/lib/globals";
import type {
  Options,
  SendMessage,
  WebSocketHook,
  WebSocketMessage,
} from "react-use-websocket/dist/lib/types";
import {useWebSocket as useWebSocketBase} from "react-use-websocket/dist/lib/use-websocket";

import {apiSocketProtocols} from "./api-endpoint";

/**
 * react-use-websocket, reconnecting with backoff for as long as it takes, and with its
 * `instanceof WebSocket` check off. Some browser extensions replace
 * `window.WebSocket`, which made that check throw an empty `Error` right after the socket opened,
 * leaving it without listeners: realtime updates silently stopped for those people.
 *
 * With `share`, messages go out on the socket the hooks share, not the library's own reference
 * to it (see `sharedSender`).
 */
export function useWebSocket<T = unknown>(
  url: string | (() => string | Promise<string>) | null,
  options: Options = {},
  connect = true
): WebSocketHook<T> {
  const socket = useWebSocketBase<T>(
    url,
    {
      skipAssert: true,
      reconnectAttempts: Infinity,
      reconnectInterval,
      // Signs in with the extension's access token, if it has one (see api-endpoint.ts).
      protocols: apiSocketProtocols(),
      ...options,
    },
    connect
  );
  // The library keys shared sockets by the URL as given (unless it rewrites it, as for these).
  const sharedUrl =
    options.share && typeof url === "string" && !options.queryParams && !options.fromSocketIO
      ? url
      : null;
  const sender = useMemo(
    () => (sharedUrl === null ? null : sharedSender(() => sharedWebSockets[sharedUrl])),
    [sharedUrl]
  );
  const {sendMessage: baseSend, readyState} = socket;
  // Every hook on a shared socket hears when it opens, so this sends what was queued while closed.
  useEffect(() => {
    if (readyState === ReadyState.OPEN) sender?.flush();
  }, [readyState, sender]);
  const sendMessage = useCallback<SendMessage>(
    (message, keep) => (sender ? sender.send(message, keep) : baseSend(message, keep)),
    [sender, baseSend]
  );
  const sendJsonMessage = useCallback(
    (message: unknown, keep?: boolean) => sendMessage(JSON.stringify(message), keep),
    [sendMessage]
  );
  return {...socket, sendMessage, sendJsonMessage};
}

// The library's own sends are typed this loosely too.
type SocketLike = {readyState: number; send?(message: WebSocketMessage): void};

/**
 * Sends on whatever socket `current` returns now, queueing (when `keep`) while it isn't open,
 * until `flush`.
 *
 * Hooks sharing a socket each schedule their own reconnect when it drops; the first to fire opens
 * the new socket, and the rest join it only when their own timers fire, up to seconds later. The
 * library tells every hook the new socket is open right away, but until then a hook's `sendMessage`
 * still points at the closed one and queues its messages, and once it joins it's already "open",
 * so they're never sent. That's how a reconnect dropped you from the call list about half the
 * time: VoiceProvider resent your call state on the old socket, and the room never heard it.
 */
export function sharedSender(current: () => SocketLike | undefined) {
  const queue: WebSocketMessage[] = [];
  const open = () => {
    const socket = current();
    return socket?.readyState === ReadyState.OPEN && socket.send ? socket : undefined;
  };
  return {
    send(message: WebSocketMessage, keep = true) {
      const socket = open();
      if (!socket) {
        if (keep) queue.push(message);
        return;
      }
      // Anything still queued goes first, so an older message never lands after a newer one.
      for (const queued of queue.splice(0)) socket.send!(queued);
      socket.send!(message);
    },
    flush() {
      const socket = open();
      if (socket) for (const message of queue.splice(0)) socket.send!(message);
    },
  };
}

/**
 * Milliseconds before reconnect attempt `attempt` (from 0; it resets once connected): 1s, 2s, 4s…
 * up to 30s, each randomly 50–150% of that. The library's default (every 5s, giving up after 20
 * tries) had every client retry in lockstep after a deploy, and stop for good after ~100s.
 */
function reconnectInterval(attempt: number) {
  return Math.min(30_000, 1000 * 2 ** attempt) * (0.5 + Math.random());
}
