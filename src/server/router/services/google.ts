import {ORPCError} from "@orpc/client";
import {env} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {AuthenticatedContext} from "../base";

export class GoogleService {
  constructor(private readonly ctx: AuthenticatedContext) {}

  async getAccessToken(workspaceId: string) {
    const workspace = await db.query.organization.findFirst({
      where: (t, {eq}) => eq(t.id, workspaceId),
    });
    if (!workspace) throw new ORPCError("NOT_FOUND");
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
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
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
      .object({access_token: z.string(), expires_in: z.number()})
      .parse(await resp.json());
    await db
      .update(schema.organization)
      .set({
        googleAccessToken: tokens.access_token,
        googleTokenExpiresAt: new Date(Date.now() + (tokens.expires_in - 60) * 1000),
      })
      .where(eq(schema.organization.id, workspaceId));
    return tokens.access_token;
  }
}
