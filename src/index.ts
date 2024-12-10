import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Mutex } from "async-mutex";
import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import { appRouter } from "../server/index";
import { createContext } from "../server/trpc";
import { DiscordClient as DiscordClientClient, syncSchema } from "./discord";

export class ChatRoom extends DurableObject {
  storage: DurableObjectStorage;
  app: Hono<{ Bindings: Env }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;

    this.app = new Hono<{ Bindings: Env }>();
    this.app.get("/api/do/chat/:puzzleId", async (c) => {
      if (c.req.header("Upgrade") != "websocket") {
        return new Response("expected websocket", { status: 400 });
      }
      const token = new URL(c.req.url).searchParams.get("token");
      if (!token) {
        return new Response("expected token", { status: 400 });
      }
      const { payload } = await jwtVerify(
        token,
        createRemoteJWKSet(
          new URL("https://auth.wafflehaus.io/.well-known/jwks"),
        ),
      );
      const pair = new WebSocketPair();
      await this.handleSession(
        pair[1],
        z.object({ given_name: z.string() }).parse(payload),
      );
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
  }

  async fetch(request: Request) {
    await this.resetAlarm();
    return await this.app.fetch(request, this.env!);
  }

  async handleSession(ws: WebSocket, { given_name }: { given_name: string }) {
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment({ ...ws.deserializeAttachment(), name: given_name });
    ws.send(JSON.stringify([...(await this.storage.list()).values()]));
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    await this.resetAlarm();
    const { name } = z
      .object({ name: z.string() })
      .parse(ws.deserializeAttachment());
    const data = {
      ...z.object({ text: z.string() }).parse(JSON.parse(message)),
      name,
      timestamp: Date.now(),
    };
    this.broadcast(data);
    const key = `${data.timestamp.toString().padStart(20)}-${crypto.randomUUID()}`;
    await this.storage.put(key, data);
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.ctx.getWebSockets().forEach((ws) => {
      ws.send(message);
    });
  }

  async resetAlarm() {
    // All chats are deleted after 7 days
    this.storage.setAlarm(Date.now() + 1000 * 60 * 60 * 24 * 7);
  }
  async alarm() {
    await this.storage.deleteAll();
  }
}

export class NotificationRoom extends DurableObject {
  app: Hono<{ Bindings: Env }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.app = new Hono<{ Bindings: Env }>();
    this.app.get("/api/do/notification/:workspaceId", async (c) => {
      if (c.req.header("Upgrade") != "websocket") {
        return new Response("expected websocket", { status: 400 });
      }
      const token = new URL(c.req.url).searchParams.get("token");
      if (!token) {
        return new Response("expected token", { status: 400 });
      }
      await jwtVerify(
        token,
        createRemoteJWKSet(
          new URL("https://auth.wafflehaus.io/.well-known/jwks"),
        ),
      );
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
    this.app.post("/broadcast", async (c) => {
      this.broadcast(
        JSON.stringify({
          ...(await c.req.json()),
          timestamp: Date.now(),
        }),
      );
      return new Response(null, { status: 200 });
    });
  }

  async fetch(request: Request) {
    return await this.app.fetch(request, this.env!);
  }

  broadcast(message: any) {
    this.ctx.getWebSockets().forEach((ws) => {
      ws.send(message);
    });
  }
}

export class PresenceRoom extends DurableObject {
  app: Hono<{ Bindings: Env }>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.app = new Hono<{ Bindings: Env }>();
    this.app.get("/api/do/presence/puzzles/:puzzleId", async (c) => {
      const puzzleId = z.string().parse(c.req.param("puzzleId"));
      if (c.req.header("Upgrade") != "websocket") {
        return new Response("expected websocket", { status: 400 });
      }
      const token = new URL(c.req.url).searchParams.get("token");
      if (!token) {
        return new Response("expected token", { status: 400 });
      }
      const { payload } = await jwtVerify(
        token,
        createRemoteJWKSet(
          new URL("https://auth.wafflehaus.io/.well-known/jwks"),
        ),
      );
      const pair = new WebSocketPair();
      const { given_name: name } = z
        .object({ given_name: z.string() })
        .parse(payload);
      await this.handleSession(pair[1], { name, puzzleId });
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
    this.app.get("/api/do/presence/workspaces/:workspaceId", async (c) => {
      if (c.req.header("Upgrade") != "websocket") {
        return new Response("expected websocket", { status: 400 });
      }
      const token = new URL(c.req.url).searchParams.get("token");
      if (!token) {
        return new Response("expected token", { status: 400 });
      }
      await jwtVerify(
        token,
        createRemoteJWKSet(
          new URL("https://auth.wafflehaus.io/.well-known/jwks"),
        ),
      );
      const pair = new WebSocketPair();
      await this.handleSession(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    });
  }

  async fetch(request: Request) {
    return await this.app.fetch(request, this.env!);
  }

  async handleSession(
    ws: WebSocket,
    data?: { name: string; puzzleId: string },
  ) {
    this.ctx.acceptWebSocket(ws);
    if (data) {
      ws.serializeAttachment(data);
    }
    this.broadcast();
  }

  webSocketClose(ws: WebSocket) {
    this.broadcast(ws);
  }

  broadcast(excludeWs?: WebSocket) {
    const participants: Record<string, string[]> = {};
    this.ctx.getWebSockets().forEach((ws) => {
      if (excludeWs === ws) {
        return;
      }
      const data = ws.deserializeAttachment();
      if (data) {
        const { name, puzzleId } = data;
        if (puzzleId) {
          participants[puzzleId] = [
            ...new Set([...(participants[puzzleId] ?? []), name]),
          ].sort();
        }
      }
    });
    this.ctx.getWebSockets().forEach((ws) => {
      ws.send(JSON.stringify(participants));
    });
  }
}

export class DiscordClient extends DurableObject {
  app: Hono<{ Bindings: Env }>;
  mutex = new Mutex();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.app = new Hono<{ Bindings: Env }>();
    this.app.post("/sync", async (c) => {
      const body = await c.req.json();
      const data = syncSchema.parse(body);
      const discordClient = new DiscordClientClient(c.env.DISCORD_BOT_TOKEN);
      await discordClient.sync(data);
    });
  }

  async fetch(request: Request) {
    return await this.mutex.runExclusive(
      async () => await this.app.fetch(request, this.env!),
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return new Response("OK");
    } else if (url.pathname.startsWith("/api/")) {
      const resp = await fetchRequestHandler({
        req: request,
        endpoint: "/api/trpc",
        router: appRouter,
        createContext: ({ req }) =>
          createContext({ req, env: env, waitUntil: ctx.waitUntil }),
      });
      return resp;
    }
    return await env.ASSETS.fetch(request);

    // We will create a `DurableObjectId` using the pathname from the Worker request
    // This id refers to a unique instance of our 'MyDurableObject' class above
    // let id: DurableObjectId = env.MY_DURABLE_OBJECT.idFromName(new URL(request.url).pathname);

    // This stub creates a communication channel with the Durable Object instance
    // The Durable Object constructor will be invoked upon the first call for a given id
    // let stub = env.MY_DURABLE_OBJECT.get(id);

    // We call the `sayHello()` RPC method on the stub to invoke the method on the remote
    // Durable Object instance
    // let greeting = await stub.sayHello("world");

    // return new Response(greeting);
  },
} satisfies ExportedHandler<Env>;
