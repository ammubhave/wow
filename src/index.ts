import { trpcServer } from "@hono/trpc-server";
import { Mutex } from "async-mutex";
import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { z } from "zod";

import { appRouter } from "../server/index";
import { createContext } from "../server/trpc";
import { DiscordClient as DiscordClientClient, syncSchema } from "./discord";
import chatDoApp from "./do/chat";
import notificationDoApp from "./do/notification";
import presenceDoApp from "./do/presence";
import discordOauthApp from "./oauth/discord";
import googleOauthApp from "./oauth/google";

export { ChatRoom } from "./do/chat";
export { NotificationRoom } from "./do/notification";
export { PresenceRoom } from "./do/presence";

export class DiscordClient extends DurableObject<Env> {
  mutex = new Mutex();

  async sync(data: z.infer<typeof syncSchema>) {
    const discordClient = new DiscordClientClient(this.env.DISCORD_BOT_TOKEN);
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
        waitUntil: c.executionCtx.waitUntil,
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
