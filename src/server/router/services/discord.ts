import {env} from "cloudflare:workers";

import {db} from "@/lib/db";

export class DiscordService {
  async sync(workspaceId: string) {
    const workspace = await db.query.organization.findFirst({
      where: {id: workspaceId},
      columns: {discordGuildId: true},
    });
    if (!workspace) throw new Error("Workspace not found");
    // Skip if discord wasn't setup for this workspace (before reading every round and puzzle).
    if (!workspace.discordGuildId) {
      return;
    }
    const rounds = await db.query.round.findMany({
      where: {workspaceId},
      columns: {name: true},
      with: {puzzles: {columns: {name: true, status: true, isMetaPuzzle: true}}},
    });
    await env.DISCORD_CLIENT.getByName(workspace.discordGuildId).sync({
      rounds,
      discordGuildId: workspace.discordGuildId,
    });
  }
}
