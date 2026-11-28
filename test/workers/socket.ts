/** A WebSocket to a Durable Object, opened through its `fetch` (as the app's routes do). */
export async function openSocket(
  stub: {fetch: (input: string, init?: RequestInit) => Promise<Response>},
  url: string,
  headers: Record<string, string> = {}
) {
  const response = await stub.fetch(url, {headers: {Upgrade: "websocket", ...headers}});
  const ws = response.webSocket;
  if (!ws) throw new Error(`No WebSocket (status ${response.status})`);
  ws.accept();
  const inbox: unknown[] = [];
  let wake: (() => void) | undefined;
  ws.addEventListener("message", event => {
    inbox.push(JSON.parse(String(event.data)));
    wake?.();
  });
  return {
    send: (message: unknown) => ws.send(JSON.stringify(message)),
    close: () => ws.close(1000),
    /** The next message (received or still to come) that matches. */
    async next<T>(match: (message: any) => boolean, timeoutMs = 5000): Promise<T> {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const i = inbox.findIndex(match);
        // The test says which message it's waiting for, so it names that message's type.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        if (i >= 0) return inbox.splice(i, 1)[0] as T;
        if (Date.now() > deadline) throw new Error("No matching message");
        // oxlint-disable-next-line no-await-in-loop
        await new Promise<void>(resolve => {
          wake = resolve;
          setTimeout(resolve, 50);
        });
      }
    },
  };
}
