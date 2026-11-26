import {createOrJoinSocket} from "react-use-websocket/dist/lib/create-or-join";
import {sharedWebSockets} from "react-use-websocket/dist/lib/globals";
import type {Options, WebSocketLike} from "react-use-websocket/dist/lib/types";
import {afterEach, beforeEach, describe, expect, it} from "vite-plus/test";

import {sharedSender} from "./use-websocket";

/** A socket the test opens and drops by hand. */
class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  sent: unknown[] = [];
  onopen?: (event: object) => void;
  onclose?: (event: object) => void;
  onmessage?: (event: object) => void;
  onerror?: (event: object) => void;
  constructor(public url: string) {
    sockets.push(this);
  }
  send(message: unknown) {
    if (this.readyState !== 1) throw new Error("Sent on a socket that isn't open");
    this.sent.push(message);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({code: 1006});
  }
}

let sockets: FakeSocket[] = [];

describe("sharedSender", () => {
  it("sends on the current socket, queueing while it isn't open", () => {
    let socket: FakeSocket | undefined;
    const sender = sharedSender(() => socket);
    sender.send("a");
    socket = new FakeSocket("ws://x");
    sender.send("b");
    sender.send("dropped", false);
    socket.open();
    // Queued messages go out before a newer one, in the order they were sent.
    sender.send("c");
    expect(socket.sent).toEqual(["a", "b", "c"]);
    sender.flush();
    expect(socket.sent).toEqual(["a", "b", "c"]);
    socket.drop();
    sender.send("d");
    socket = new FakeSocket("ws://x");
    socket.open();
    sender.flush();
    expect(socket.sent).toEqual(["d"]);
  });
});

// The library's own sharing, without React: two hooks on one URL, as WorkspaceProvider and
// VoiceProvider share the workspace socket.
describe("a shared socket reconnected by another hook", () => {
  const url = "ws://x/api/workspaces/a?diffs";
  const realWebSocket = globalThis.WebSocket;
  beforeEach(() => {
    sockets = [];
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a stand-in for the browser's.
    globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  });
  afterEach(() => {
    globalThis.WebSocket = realWebSocket;
    delete sharedWebSockets[url];
  });

  /** One hook: its own reference to the socket, and its own (here, manual) reconnect. */
  function hook() {
    const webSocketRef: {current: WebSocketLike | null} = {current: null};
    const startRef = {current: () => {}};
    // Reconnecting is left to the test, to choose which hook goes first.
    const optionsRef = {current: {share: true, shouldReconnect: () => false} satisfies Options};
    const join = () =>
      createOrJoinSocket(
        webSocketRef,
        url,
        () => {},
        optionsRef,
        () => {},
        startRef,
        {current: 0},
        {current: Date.now()},
        () => {}
      );
    let leave = join();
    startRef.current = () => {
      leave();
      leave = join();
    };
    return {webSocketRef, reconnect: () => startRef.current(), leave: () => leave()};
  }

  it("sends on the new socket before this hook's own reconnect", () => {
    const workspace = hook();
    const voice = hook();
    const send = sharedSender(() => sharedWebSockets[url]);
    sockets[0]!.open();
    send.send("in the call");
    expect(sockets[0]!.sent).toEqual(["in the call"]);

    sockets[0]!.drop();
    send.send("queued while closed");
    // The workspace hook's timer fires first and opens a new socket; voice's hasn't fired yet.
    workspace.reconnect();
    sockets[1]!.open();
    // The library still has voice pointing at the closed socket (the bug)...
    expect(voice.webSocketRef.current).toBe(sockets[0]);
    // ...but the shared sender goes through the new one.
    send.flush();
    send.send("in the call again");
    expect(sockets[1]!.sent).toEqual(["queued while closed", "in the call again"]);

    // Voice's own timer joins the same socket rather than opening another.
    voice.reconnect();
    expect(sockets).toHaveLength(2);
    workspace.leave();
    voice.leave();
  });
});
