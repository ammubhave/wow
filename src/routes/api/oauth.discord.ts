import {createFileRoute, redirect} from "@tanstack/react-router";
import {waitUntil} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {invalidateWorkspace} from "@/server/do/workspace";
import {DiscordService} from "@/server/router/services/discord";
import {authorizeWorkspaceRequest, safeRedirectPath} from "@/server/workspace-access";

export const Route = createFileRoute("/api/oauth/discord")({
  server: {
    handlers: {
      GET: async ({request}) => {
        const url = new URL(request.url);
        const state = z
          .object({redirectUrl: z.string(), workspaceSlug: z.string()})
          .safeParse(
            Object.fromEntries(new URLSearchParams(url.searchParams.get("state") ?? "").entries())
          );
        if (!state.success) return new Response("Invalid OAuth state", {status: 400});
        const {redirectUrl: rawRedirectUrl, workspaceSlug} = state.data;
        // `redirectUrl` comes from the (client-controlled) state: only allow same-origin paths.
        const redirectUrl = safeRedirectPath(rawRedirectUrl, request.url);
        // The state is client-controlled too: only an owner may connect an account to a workspace.
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug, {ownerOnly: true});
        if (authz.response) return authz.response;
        if (url.searchParams.get("error")) {
          let errorMessage = url.searchParams.get("error")!;
          if (errorMessage === "access_denied") {
            errorMessage = "Discord connection request was denied.";
          }
          return redirect({
            href: `${redirectUrl}?${new URLSearchParams({error_message: errorMessage}).toString()}`,
          });
        }
        const guildId = z.string().parse(url.searchParams.get("guild_id"));

        await db
          .update(schema.organization)
          .set({discordGuildId: guildId})
          .where(eq(schema.organization.id, authz.workspace.id));

        await invalidateWorkspace(authz.workspace.id);
        waitUntil(new DiscordService().sync(authz.workspace.id));
        return redirect({href: redirectUrl});
      },
    },
  },
});
