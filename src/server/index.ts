import { trpcServer } from "@hono/trpc-server";
import { Mutex } from "async-mutex";
import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { z } from "zod";

import {
  DiscordClient as DiscordClientClient,
  syncSchema,
} from "./api/discord";
import chatDoApp from "./api/do/chat";
import notificationDoApp from "./api/do/notification";
import presenceDoApp from "./api/do/presence";
import discordOauthApp from "./api/oauth/discord";
import googleOauthApp from "./api/oauth/google";
import { appRouter } from "./router";
import { createContext } from "./trpc";

export { ChatRoom } from "./api/do/chat";
export { NotificationRoom } from "./api/do/notification";
export { PresenceRoom } from "./api/do/presence";
export { DeleteChannelAfterDelayWorkflow } from "./api/discord";

export class DiscordClient extends DurableObject<Env> {
  mutex = new Mutex();

  async sync(data: z.infer<typeof syncSchema>) {
    const discordClient = new DiscordClientClient(this.env);
    await this.mutex.runExclusive(async () => {
      await discordClient.sync(data);
    });
  }
}

const app = new Hono<{ Bindings: Env }>();

app.get("/healthz", async (c) => {
  return c.text("OK");
});

app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext: (opts, c) =>
      createContext({
        req: opts.req,
        env: c.env,
        waitUntil: (promise: Promise<unknown>) =>
          c.executionCtx.waitUntil(promise),
      }),
  }),
);

app.route("/api/oauth/discord", discordOauthApp);
app.route("/api/oauth/google", googleOauthApp);

app.route("/api/do/chat", chatDoApp);
app.route("/api/do/notification", notificationDoApp);
app.route("/api/do/presence", presenceDoApp);

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
