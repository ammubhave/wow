import { Context } from "../trpc";

export class DiscordService {
  constructor(
    private readonly env: Env,
    private readonly ctx: Context,
  ) {}

  async sync(workspaceId: string) {
    const workspace = await this.ctx.db.workspace.findFirstOrThrow({
      select: {
        discordGuildId: true,
        rounds: {
          select: {
            name: true,
            puzzles: {
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
    await this.env.DISCORD_CLIENT.get(
      this.env.DISCORD_CLIENT.idFromName(workspace.discordGuildId),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ).sync(workspace as any);
  }
}
