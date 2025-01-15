import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import { z } from "zod";

export const syncSchema = z.object({
  discordGuildId: z.string(),
  rounds: z.array(
    z.object({
      name: z.string(),
      puzzles: z.array(
        z.object({
          isMetaPuzzle: z.boolean(),
          name: z.string(),
          status: z.string().nullable(),
        }),
      ),
    }),
  ),
});

export class DiscordClient {
  constructor(private env: Env) {}

  private async fetchDiscord(
    url: string,
    init?: Omit<RequestInit<RequestInitCfProperties>, "body"> & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body?: any;
    },
  ) {
    return await fetch(`https://discord.com/api/v10${url}`, {
      ...init,
      headers: {
        authorization: `Bot ${this.env.DISCORD_BOT_TOKEN}`,
        ...(init?.body
          ? {
              "content-type": "application/json",
            }
          : {}),
        ...init?.headers,
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  }

  public async sync(workspace: z.infer<typeof syncSchema>) {
    const allPuzzles = workspace.rounds
      .map((round) => ({
        name: round.name,
        puzzles: round.puzzles
          .filter(
            (puzzle) =>
              puzzle.status !== "solved" &&
              puzzle.status !== "backsolved" &&
              puzzle.status !== "obsolete",
          )
          .map((puzzle) => ({
            name: `${puzzle.isMetaPuzzle ? "[META] " : ""}${puzzle.name}`,
            status: puzzle.status,
          })),
      }))
      .filter((round) => round.puzzles.length > 0);

    const channelsWithDuplicates = await this.listChannels(
      workspace.discordGuildId,
    );
    if (channelsWithDuplicates === undefined) {
      return;
    }

    // Delete duplicate channels
    const channels: typeof channelsWithDuplicates = [];
    for (const [_, duplicates] of Object.entries(
      Object.groupBy(channelsWithDuplicates, (channel) => channel.name),
    )) {
      if (duplicates === undefined) {
        continue;
      }
      for (const duplicate of duplicates?.slice(1) ?? []) {
        await this.deleteChannel(duplicate.id);
      }
      channels.push(duplicates[0]);
    }

    const categories = new Map(
      channels
        .filter((channel) => channel.type === 4)
        .map((channel) => [channel.name, channel.id]),
    );

    // Create new categories
    const rounds = new Set<string>();
    for (const round of allPuzzles) {
      rounds.add(round.name);
      if (!categories.has(round.name)) {
        const newCategory = await this.createChannel({
          guildId: workspace.discordGuildId,
          name: round.name,
          type: 4,
        });
        categories.set(round.name, newCategory.id);
      }
    }

    const voices = new Map(
      channels
        .filter((channel) => channel.type === 2)
        .map((channel) => [
          channel.name,
          { id: channel.id, parentId: channel.parent_id },
        ]),
    );
    // Add new voice channels
    const puzzles = new Map<string, string>();
    for (const round of allPuzzles) {
      for (const puzzle of round.puzzles) {
        puzzles.set(puzzle.name, round.name);
        if (!voices.has(puzzle.name)) {
          await this.createChannel({
            guildId: workspace.discordGuildId,
            name: puzzle.name,
            type: 2,
            parentId: categories.get(round.name),
          });
        } else if (
          voices.get(puzzle.name)!.parentId !== categories.get(round.name)
        ) {
          await this.updateChannel(voices.get(puzzle.name)!.id, {
            parentId: categories.get(round.name),
          });
        }
      }
    }

    // Delete old voice channels
    for (const [voiceName, channelId] of voices) {
      if (!puzzles.has(voiceName)) {
        await this.updateChannel(channelId.id, {
          name: "❌ Obsolete Channel",
        });
        await this.env.DELETE_CHANNEL_AFTER_DELAY_WORKFLOW.create({
          id: crypto.randomUUID(),
          params: {
            channelId: channelId.id,
          },
        });
      }
    }

    // Delete old categories
    for (const [categoryName, channelId] of categories) {
      if (!rounds.has(categoryName)) {
        await this.deleteChannel(channelId);
      }
    }
  }

  public async createChannel({
    guildId,
    name,
    type,
    parentId,
  }: {
    guildId: string;
    name: string;
    type: number;
    parentId?: string;
  }) {
    const response = await (
      await this.fetchDiscord(`/guilds/${guildId}/channels`, {
        method: "POST",
        body: {
          name: `🧩 ${name}`,
          type,
          parent_id: parentId ?? null,
        },
      })
    ).json();
    return z.object({ id: z.string() }).parse(response);
  }

  public async updateChannel(
    channelId: string,
    data: { parentId?: string | null; name?: string },
  ) {
    return await (
      await this.fetchDiscord(`/channels/${channelId}`, {
        method: "PATCH",
        body: {
          parent_id: data.parentId,
          name: data.name,
        },
      })
    ).json();
  }

  public async deleteChannel(channelId: string) {
    return await this.fetchDiscord(`/channels/${channelId}`, {
      method: "DELETE",
    });
  }

  public async listChannels(workspaceId: string) {
    const response = await this.fetchDiscord(`/guilds/${workspaceId}/channels`);
    if (response.status !== 200) {
      return undefined;
    }
    const schema = z.object({
      id: z.string(),
      name: z.string(),
      type: z.number(),
      parent_id: z.string().nullable(),
    });
    return z
      .array(z.any())
      .transform((as) =>
        as.flatMap((a) => {
          const parsed = schema.safeParse(a);
          if (parsed.success) {
            return [parsed.data];
          }
          return [];
        }),
      )
      .parse(await response.json())
      .filter((channel) => channel.name.startsWith("🧩 "))
      .map((channel) => ({
        ...channel,
        name: channel.name.replace("🧩 ", ""),
      }));
  }
}

type DeleteChannelAfterDelayWorkflowParams = {
  channelId: string;
};
export class DeleteChannelAfterDelayWorkflow extends WorkflowEntrypoint<
  Env,
  DeleteChannelAfterDelayWorkflowParams
> {
  async run(
    event: WorkflowEvent<DeleteChannelAfterDelayWorkflowParams>,
    step: WorkflowStep,
  ) {
    await step.sleep("sleep for 1 minute", "1 minute");
    const discordClient = new DiscordClient(this.env);
    await discordClient.deleteChannel(event.payload.channelId);
  }
}
