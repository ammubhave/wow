import {createFileRoute, redirect} from "@tanstack/react-router";
import {eq} from "drizzle-orm";
import z from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const Route = createFileRoute("/api/oauth/google")({
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
            errorMessage = "Google connection request was denied.";
          }
          return redirect({
            href: `${redirectUrl}?${new URLSearchParams({error_message: errorMessage}).toString()}`,
          });
        }
        const code = z.string().parse(url.searchParams.get("code"));
        for (const key of Array.from(url.searchParams.keys())) {
          url.searchParams.delete(key);
        }
        const resp = await (
          await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: new URLSearchParams({
              redirect_uri: url.toString(),
              client_id: process.env.VITE_GOOGLE_API_CLIENT_ID,
              client_secret: process.env.GOOGLE_API_CLIENT_SECRET,
              grant_type: "authorization_code",
              code,
            }),
          })
        ).json();
        const tokens = z
          .object({access_token: z.string(), expires_in: z.number(), refresh_token: z.string()})
          .parse(resp);

        await db
          .update(schema.organization)
          .set({
            googleAccessToken: tokens.access_token,
            googleTokenExpiresAt: new Date(Date.now() + (tokens.expires_in - 60) * 1000),
            googleRefreshToken: tokens.refresh_token,
          })
          .where(eq(schema.organization.slug, workspaceId));
        return redirect({href: redirectUrl});
      },
    },
  },
});
