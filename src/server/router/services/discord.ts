import {env} from "cloudflare:workers";

import {db} from "@/lib/db";

export class DiscordService {
  constructor() {}

  async sync(workspaceId: string) {
    const workspace = await db.query.organization.findFirst({
      where: (t, {eq}) => eq(t.id, workspaceId),
    });
    if (!workspace) throw new Error("Workspace not found");
    const rounds = await db.query.round.findMany({
      where: (t, {eq}) => eq(t.workspaceId, workspace.id),
      with: {puzzles: true},
    });
    // Skip if discord wasn't setup for this workspace.
    if (!workspace.discordGuildId) {
      return;
    }
    await env.DISCORD_CLIENT.getByName(workspace.discordGuildId).sync({
      ...workspace,
      rounds,
      discordGuildId: workspace.discordGuildId,
    });
  }
}
