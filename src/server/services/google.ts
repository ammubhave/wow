import { z } from "zod";

import { Context } from "../trpc";

export class GoogleService {
  constructor(private readonly ctx: Context) {}

  async getAccessToken(workspaceId: string) {
    const workspace = await this.ctx.db.workspace.findFirstOrThrow({
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
        client_id: this.ctx.env.VITE_GOOGLE_API_CLIENT_ID,
        client_secret: this.ctx.env.GOOGLE_API_CLIENT_SECRET,
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
    await this.ctx.prisma.workspace.update({
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
  }
}
