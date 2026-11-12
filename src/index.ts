import handler from "@tanstack/react-start/server-entry";
import {eq} from "drizzle-orm";
import PostalMime from "postal-mime";

import {db} from "./lib/db";
import * as schema from "./lib/db/schema";
import {fetchDiscord} from "./server/do/discord-client";
import {captureServerException} from "./server/posthog";

/**
 * Dotfile paths (`/.env`, `/.git/config`, `/.aws/credentials`, ...): only vulnerability scanners ask
 * for these, hundreds at a time. The app has none, so answer 404 before it runs: otherwise each one
 * checks the session, redirects to /login and renders the app shell for a client that hangs up
 * mid-stream (Cloudflare then logs "Network connection lost." and cross-request promise warnings).
 * `/.well-known/` stays open for standard discovery files.
 */
const isScannerProbe = (pathname: string) =>
  pathname.startsWith("/.") && !pathname.startsWith("/.well-known/");

export default {
  async fetch(request) {
    if (isScannerProbe(new URL(request.url).pathname)) {
      return new Response("Not found", {status: 404});
    }
    try {
      const response = await handler.fetch(request);
      // Websocket routes catch their own errors (webSocketRoute), so a 500 here was thrown by the
      // framework after the route returned: say so, since its own log line drops the cause.
      if (
        response.status === 500 &&
        request.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ) {
        console.warn(
          `WebSocket ${new URL(request.url).pathname}: 500 after the route returned` +
            ` (client disconnected: ${request.signal.aborted})`
        );
      }
      return response;
    } catch (error) {
      captureServerException(error, {properties: {path: new URL(request.url).pathname}});
      throw error;
    }
  },

  async email(message) {
    const workspaceSlug = message.to.split("@")[0]!;
    const workspace = await db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.slug, workspaceSlug))
      .get();
    if (!workspace) {
      message.setReject("Workspace not found");
      return;
    }
    if (!workspace.discordGuildId) {
      message.setReject("Discord not configured for workspace");
      return;
    }

    const data: {id: string; type: number; name?: string}[] = await (
      await fetchDiscord(`/guilds/${workspace.discordGuildId}/channels`)
    ).json();
    const channel = data.find(c => c.type === 0 && c.name === "email-updates");
    if (!channel) {
      message.setReject("Channel '#email-updates' not found");
      return;
    }

    const email = await PostalMime.parse(message.raw);
    const formData = new FormData();
    console.log(email);
    formData.append("content", `**${email.subject}**\n\n${email.text}`);
    const response = await fetchDiscord(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: formData,
    });
    console.log("Discord message response:", response.status, await response.json());
  },
} satisfies ExportedHandler;

export {DiscordClient} from "./server/do/discord-client";
export {ChatRoom} from "./server/do/chat";
export {NotificationRoom} from "./server/do/notification";
export {PresenceRoom} from "./server/do/presence";
export {DeleteChannelAfterDelayWorkflow} from "./server/do/discord-client";
export {WorkspaceRoom} from "./server/do/workspace";
export {WhiteboardRoom} from "./server/do/whiteboard";
export {SheetRoom} from "./server/do/sheet";
