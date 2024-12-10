import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { Hono } from "hono";
import { z } from "zod";

const app = new Hono<{ Bindings: Env }>();

app.all("/", async (c) => {
  const libsql = createClient({
    url: c.env.TURSO_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  const prisma = new PrismaClient({ adapter });

  const url = new URL(c.req.url);
  const { redirectUrl, workspaceId } = z
    .object({ redirectUrl: z.string(), workspaceId: z.string() })
    .parse(
      Object.fromEntries(
        new URLSearchParams(
          z.string().parse(url.searchParams.get("state")),
        ).entries(),
      ),
    );
  if (url.searchParams.get("error")) {
    let errorMessage = url.searchParams.get("error")!;
    if (errorMessage === "access_denied") {
      errorMessage = "Discord connection request was denied.";
    }
    return new Response(null, {
      headers: {
        location: `${redirectUrl}?${new URLSearchParams({ error_message: errorMessage }).toString()}`,
      },
      status: 302,
    });
  }
  const guildId = z.string().parse(url.searchParams.get("guild_id"));
  const workspace = await prisma.workspace.update({
    where: {
      id: workspaceId,
    },
    data: {
      discordGuildId: guildId,
    },
    select: {
      discordGuildId: true,
      rounds: {
        select: {
          name: true,
          metaPuzzles: {
            select: {
              name: true,
              status: true,
              puzzles: {
                select: {
                  name: true,
                  status: true,
                },
              },
            },
          },
          unassignedPuzzles: {
            select: {
              name: true,
              status: true,
            },
          },
        },
      },
    },
  });
  c.executionCtx.waitUntil(
    (async () => {
      c.env.DISCORD_CLIENT.get(c.env.DISCORD_CLIENT.idFromName(guildId)).sync(
        workspace as any,
      );
    })(),
  );
  return new Response(null, {
    headers: {
      location: redirectUrl,
    },
    status: 302,
  });
});

export default app;
