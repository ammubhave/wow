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
  // For dev
  if (url.hostname === "localhost" && url.port === "8787") {
    url.port = "8788";
  }

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
      errorMessage = "Google connection request was denied.";
    }
    return new Response(null, {
      headers: {
        location: `${redirectUrl}?${new URLSearchParams({ error_message: errorMessage }).toString()}`,
      },
      status: 302,
    });
  }
  const code = z.string().parse(url.searchParams.get("code"));
  for (const key of Array.from(url.searchParams.keys())) {
    url.searchParams.delete(key);
  }
  const resp = await (
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        redirect_uri: url.toString(),
        client_id: c.env.VITE_GOOGLE_API_CLIENT_ID,
        client_secret: c.env.GOOGLE_API_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
      }),
    })
  ).json();
  const tokens = z
    .object({
      access_token: z.string(),
      expires_in: z.number(),
      refresh_token: z.string(),
    })
    .parse(resp);

  await prisma.workspace.update({
    where: {
      id: workspaceId,
    },
    data: {
      googleAccessToken: tokens.access_token,
      googleTokenExpiresAt: new Date(
        Date.now() + (tokens.expires_in - 60) * 1000,
      ),
      googleRefreshToken: tokens.refresh_token,
    },
  });

  return new Response(null, {
    headers: {
      location: redirectUrl,
    },
    status: 302,
  });
});

export default app;
