import {env} from "cloudflare:workers";

import {db} from "@/lib/db";

export class DiscordService {
  async sync(workspaceId: string) {
    const board = await discordBoard({id: workspaceId});
    if (!board) return;
    await env.DISCORD_CLIENT.getByName(board.discordGuildId).sync(board);
  }
}

/**
 * What a workspace's Discord server should mirror: its rounds and puzzles. Null when it has no
 * server, or the team chose WOW calls (the channels stay as they were, untouched until they switch
 * back). Looked up by workspace, or by server (DiscordClient retrying a failed sync).
 */
export async function discordBoard(where: {id: string} | {discordGuildId: string}) {
  const workspace = await db.query.organization.findFirst({
    where,
    columns: {id: true, discordGuildId: true, voiceTool: true},
  });
  if ("id" in where && !workspace) throw new Error("Workspace not found");
  // Checked before reading every round and puzzle.
  if (!workspace?.discordGuildId || workspace.voiceTool !== "discord") return null;
  const rounds = await db.query.round.findMany({
    where: {workspaceId: workspace.id},
    columns: {name: true},
    with: {
      puzzles: {
        columns: {id: true, name: true, status: true, importance: true, isMetaPuzzle: true},
      },
    },
  });
  return {rounds, discordGuildId: workspace.discordGuildId};
}
