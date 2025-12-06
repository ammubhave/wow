import {env} from "cloudflare:workers";

import {AuthenticatedContext} from "../base";

export class DiscordService {
  constructor(private readonly ctx: AuthenticatedContext) {}

  async sync(workspaceId: string) {
    const workspace = await this.ctx.db.workspace.findFirstOrThrow({
      select: {
        discordGuildId: true,
        rounds: {
          select: {name: true, puzzles: {select: {name: true, status: true, isMetaPuzzle: true}}},
        },
      },
      where: {id: workspaceId},
    });
    // Skip if discord wasn't setup for this workspace.
    if (!workspace.discordGuildId) {
      return;
    }
    await env.DISCORD_CLIENT.getByName(workspace.discordGuildId).sync({
      ...workspace,
      discordGuildId: workspace.discordGuildId,
    });
  }
}
