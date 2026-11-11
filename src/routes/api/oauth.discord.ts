import {createFileRoute, redirect} from "@tanstack/react-router";
import {waitUntil} from "cloudflare:workers";
import {and, eq, ne} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {isOAuthStateFromThisBrowser} from "@/lib/oauth-state";
import {invalidateWorkspace} from "@/server/do/workspace";
import {DiscordService} from "@/server/router/services/discord";
import {authorizeWorkspaceRequest, safeRedirectPath} from "@/server/workspace-access";

/**
 * The server Discord says the bot was just added to, from the authorization code (Discord returns
 * the guild with the token for the `bot` scope). Needs the app's client secret; without one,
 * returns undefined and the callback can't check the guild against the code.
 */
async function guildFromCode(code: string, redirectUri: string) {
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientSecret) return undefined;
  const resp = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: process.env.VITE_DISCORD_CLIENT_ID,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const parsed = z.object({guild: z.object({id: z.string()})}).safeParse(await resp.json());
  return parsed.success ? parsed.data.guild.id : null;
}

export const Route = createFileRoute("/api/oauth/discord")({
  server: {
    handlers: {
      GET: async ({request}) => {
        const url = new URL(request.url);
        const state = z
          .object({
            redirectUrl: z.string(),
            workspaceSlug: z.string(),
            nonce: z.string().optional(),
          })
          .safeParse(
            Object.fromEntries(new URLSearchParams(url.searchParams.get("state") ?? "").entries())
          );
        if (!state.success) return new Response("Invalid OAuth state", {status: 400});
        const {redirectUrl: rawRedirectUrl, workspaceSlug, nonce} = state.data;
        // `redirectUrl` comes from the (client-controlled) state: only allow same-origin paths.
        const redirectUrl = safeRedirectPath(rawRedirectUrl, request.url);
        // Only finish a flow this browser started (see oauth-state.ts).
        if (!isOAuthStateFromThisBrowser(request, nonce)) {
          return new Response("This Discord connection link expired. Start again from settings.", {
            status: 400,
          });
        }
        // The state is client-controlled too: only an owner may connect an account to a workspace.
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug, {ownerOnly: true});
        if (authz.response) return authz.response;
        const fail = (message: string) =>
          redirect({
            href: `${redirectUrl}?${new URLSearchParams({error_message: message}).toString()}`,
          });
        if (url.searchParams.get("error")) {
          let errorMessage = url.searchParams.get("error")!;
          if (errorMessage === "access_denied") {
            errorMessage = "Discord connection request was denied.";
          }
          return fail(errorMessage);
        }
        const guildId = z.string().min(1).parse(url.searchParams.get("guild_id"));

        // `guild_id` is just a URL parameter, and server ids are public: on its own it doesn't
        // prove this owner added the bot to that server. Check it against the authorization code
        // when the client secret is configured...
        if (!process.env.DISCORD_CLIENT_SECRET) {
          console.warn(
            "DISCORD_CLIENT_SECRET isn't set: connecting a Discord server without checking the code"
          );
        } else {
          const code = url.searchParams.get("code");
          const verifiedGuildId = code
            ? await guildFromCode(code, `${url.origin}${url.pathname}`)
            : null;
          if (verifiedGuildId !== guildId) {
            return fail("Couldn't confirm the bot was added to that Discord server. Try again.");
          }
        }
        // ...and never take over a server another workspace is already using (its channels would
        // be rewritten or deleted to match this board).
        const taken = await db
          .select({id: schema.organization.id})
          .from(schema.organization)
          .where(
            and(
              eq(schema.organization.discordGuildId, guildId),
              ne(schema.organization.id, authz.workspace.id)
            )
          )
          .get();
        if (taken) return fail("That Discord server is already connected to another workspace.");

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
