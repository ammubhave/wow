import {createFileRoute, redirect} from "@tanstack/react-router";
import {eq} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {invalidateWorkspace} from "@/server/do/workspace";
import {authorizeWorkspaceRequest, safeRedirectPath} from "@/server/workspace-access";

export const Route = createFileRoute("/api/oauth/google")({
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
          .where(eq(schema.organization.id, authz.workspace.id));
        // `googleConnected` is part of the broadcast workspace state.
        await invalidateWorkspace(authz.workspace.id);
        return redirect({href: redirectUrl});
      },
    },
  },
});
