import handler from "@tanstack/react-start/server-entry";
import {eq} from "drizzle-orm";

import {db} from "./lib/db";
import * as schema from "./lib/db/schema";
import {fetchDiscord} from "./server/do/discord-client";

export default {
  fetch(request) {
    return handler.fetch(request);
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
    const [channel] = data.filter(c => c.type === 0 && c.name === "email-updates");
    if (!channel) {
      message.setReject("Channel '#email-updates' not found");
      return;
    }

    const text = await new Response(message.raw).text();

    const formData = new FormData();
    formData.append("content", `**${message.headers.get("Subject")}**\n\n${text}`);
    await fetchDiscord(`/channels/${channel.id}/messages`, {method: "POST", body: formData});
  },
} satisfies ExportedHandler;

export {DiscordClient} from "./server/do/discord-client";
export {ChatRoom} from "./server/do/chat";
export {NotificationRoom} from "./server/do/notification";
export {PresenceRoom} from "./server/do/presence";
export {DeleteChannelAfterDelayWorkflow} from "./server/do/discord-client";
