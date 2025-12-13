import {DurableObject} from "cloudflare:workers";

export class NotificationRoom extends DurableObject<Env> {
  async fetch() {
    const {"0": client, "1": server} = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, {status: 101, webSocket: client});
  }

  async handleSession(ws: WebSocket) {
    this.ctx.acceptWebSocket(ws);
  }

  broadcast(
    message: ({type: "invalidate"} | {type: "solved"; message: string}) & {timestamp: number}
  ) {
    this.ctx.getWebSockets().forEach(ws => {
      ws.send(JSON.stringify(message));
    });
  }
}
