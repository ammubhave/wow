import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { initTRPC } from "@trpc/server";
import { enhance } from "@zenstackhq/runtime";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

export const createContext = async ({
  req,
  env,
  waitUntil,
}: {
  req: Request;
  env: Env;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waitUntil: (promise: Promise<any>) => void;
}) => {
  const libsql = createClient({
    url: env.TURSO_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  const prisma = new PrismaClient({ adapter });

  const jwt = z.string().parse(req.headers.get("authorization")).slice(7);
  const payload = z
    .object({
      given_name: z.string(),
      email: z.string(),
      sub: z.string(),
    })
    .parse(
      (
        await jwtVerify(
          jwt,
          createRemoteJWKSet(
            new URL("https://auth.wafflehaus.io/.well-known/jwks"),
          ),
        )
      ).payload,
    );
  const db = enhance(prisma, { user: { id: payload.sub } });

  return {
    env,
    prisma,
    db,
    waitUntil,
    syncDiscord: async (workspaceId: string) => {
      const workspace = await db.workspace.findFirstOrThrow({
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
        where: { id: workspaceId },
      });
      // Skip if discord wasn't setup for this workspace.
      if (!workspace.discordGuildId) {
        return;
      }
      await env.DISCORD_CLIENT.get(
        env.DISCORD_CLIENT.idFromName(workspace.discordGuildId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ).sync(workspace as any);
    },
    user: {
      id: payload.sub,
      firstName: payload.given_name,
      email: payload.email,
    },
    broadcastNotification: async (
      workspaceId: string,
      data: // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | { type: "notification"; paths: { path: string[]; input?: any }[] }
        | {
            type: "message";
            text: string;
          },
    ) => {
      const room = env.NOTIFICATION_ROOMS.get(
        env.NOTIFICATION_ROOMS.idFromName(workspaceId),
      );
      await room.broadcast(
        JSON.stringify({
          ...data,
          timestamp: Date.now(),
        }),
      );
    },
    getKindeM2MAccessToken: async () => {
      return z.object({ access_token: z.string() }).parse(
        await (
          await fetch(`https://wafflehaus.kinde.com/oauth2/token`, {
            method: "POST",
            headers: {
              "content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              audience: "https://wafflehaus.kinde.com/api",
              grant_type: "client_credentials",
              client_id: env.KINDE_CLIENT_ID,
              client_secret: env.KINDE_CLIENT_SECRET,
            }),
          })
        ).json(),
      ).access_token;
    },
    getGoogleToken: async (workspaceId: string) => {
      const workspace = await db.workspace.findFirstOrThrow({
        where: { id: workspaceId },
      });
      if (!workspace.googleAccessToken || !workspace.googleTokenExpiresAt) {
        return null;
      }
      if (workspace.googleTokenExpiresAt > new Date()) {
        return workspace.googleAccessToken;
      }
      if (!workspace.googleRefreshToken) {
        return null;
      }
      const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          refresh_token: workspace.googleRefreshToken,
          client_id: env.VITE_GOOGLE_API_CLIENT_ID,
          client_secret: env.GOOGLE_API_CLIENT_SECRET,
          grant_type: "refresh_token",
        }),
      });
      if (resp.status !== 200) {
        return null;
      }
      const tokens = z
        .object({
          access_token: z.string(),
          expires_in: z.number(),
        })
        .parse(await resp.json());
      await prisma.workspace.update({
        where: {
          id: workspaceId,
        },
        data: {
          googleAccessToken: tokens.access_token,
          googleTokenExpiresAt: new Date(
            Date.now() + (tokens.expires_in - 60) * 1000,
          ),
        },
      });
      return tokens.access_token;
    },
  };
};
type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create();
export const router = t.router;
export const procedure = t.procedure;
