import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const onRequest: PagesFunction<Env> = async (context) => {
  const libsql = createClient({
    url: context.env.TURSO_URL,
    authToken: context.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  const prisma = new PrismaClient({ adapter });

  const url = new URL(context.request.url);
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
  context.waitUntil(
    (async () => {
      context.env.DISCORD_CLIENT.get(
        context.env.DISCORD_CLIENT.idFromName(guildId),
      )!.fetch(
        new Request("https://example.com/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(workspace),
        }),
      );
    })(),
  );
  return new Response(null, {
    headers: {
      location: redirectUrl,
    },
    status: 302,
  });
};
