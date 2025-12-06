import {createFileRoute, redirect} from "@tanstack/react-router";
import {env, waitUntil} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import z from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const Route = createFileRoute("/api/oauth/discord")({
  server: {
    handlers: {
      GET: async ({request}) => {
        const url = new URL(request.url);
        const {redirectUrl, workspaceId} = z
          .object({redirectUrl: z.string(), workspaceId: z.string()})
          .parse(
            Object.fromEntries(
              new URLSearchParams(z.string().parse(url.searchParams.get("state"))).entries()
            )
          );
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
          .where(eq(schema.organization.slug, workspaceId));
        // const prisma = getPrisma();
        // const workspace = await prisma.workspace.update({
        //   where: {id: workspaceId},
        //   data: {discordGuildId: guildId},
        //   select: {
        //     discordGuildId: true,
        //     rounds: {select: {name: true, puzzles: {select: {name: true, status: true}}}},
        //   },
        // });

        const workspace = await db.query.organization.findFirst({
          where: (t, {eq}) => eq(t.slug, workspaceId),
        });
        if (!workspace) throw new Error("Workspace not found");
        const rounds = await db.query.round.findMany({
          where: (t, {eq}) => eq(t.workspaceId, workspace.id),
          with: {puzzles: true},
        });

        waitUntil(
          (async () => {
            await env.DISCORD_CLIENT.get(env.DISCORD_CLIENT.idFromName(guildId)).sync({
              ...workspace,
              rounds,
            } as any);
          })()
        );
        return redirect({href: redirectUrl});
      },
    },
  },
});
