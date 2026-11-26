import {
  DurableObject,
  env,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import {z} from "zod";

import {
  CATEGORY,
  desiredRounds,
  planSync,
  retryAfterSeconds,
  type SyncRound,
  VOICE,
} from "../discord-sync-plan";

/** Attempts per request when Discord rate-limits it (429), and the longest wait we'll sit out. */
const MAX_ATTEMPTS = 5;
const MAX_RETRY_WAIT_SECONDS = 60;

/**
 * A Discord API request. Rate-limited requests (429) are retried after the wait Discord asks for,
 * up to MAX_ATTEMPTS; after that, or for a longer wait, the 429 response is returned.
 */
export async function fetchDiscord(
  url: string,
  init?: Omit<RequestInit<RequestInitCfProperties>, "body"> & {body?: any}
) {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  headers.set("authorization", `Bot ${env.DISCORD_BOT_TOKEN}`);
  const body = init?.body
    ? init.body instanceof FormData
      ? init.body
      : JSON.stringify(init.body)
    : undefined;
  for (let attempt = 1; ; attempt++) {
    // Retries are sequential by nature.
    // oxlint-disable-next-line no-await-in-loop
    const response = await fetch(`https://discord.com/api/v10${url}`, {...init, headers, body});
    if (response.status !== 429 || attempt >= MAX_ATTEMPTS) return response;
    // oxlint-disable-next-line no-await-in-loop
    const json: unknown = await response
      .clone()
      .json()
      .catch(() => undefined);
    const seconds = retryAfterSeconds(json, response.headers.get("retry-after"));
    if (seconds > MAX_RETRY_WAIT_SECONDS) return response;
    // oxlint-disable-next-line no-await-in-loop
    await new Promise(resolve => setTimeout(resolve, seconds * 1000 + 100));
  }
}

export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    method: string,
    url: string,
    detail: string
  ) {
    super(`Discord ${method} ${url} failed with ${status}: ${detail.slice(0, 500)}`);
    this.name = "DiscordApiError";
  }
}

/** A Discord API request that throws a DiscordApiError unless it succeeds; returns the JSON body. */
async function discordRequest(
  url: string,
  init?: Parameters<typeof fetchDiscord>[1]
): Promise<unknown> {
  const response = await fetchDiscord(url, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new DiscordApiError(response.status, init?.method ?? "GET", url, detail);
  }
  if (response.status === 204) return undefined;
  return await response.json();
}

type SyncWorkspace = {discordGuildId: string; rounds: SyncRound[]};

/** Storage key for the puzzle id → voice channel id mapping. */
const PUZZLE_CHANNELS_KEY = "puzzleChannels";

export class DiscordClient extends DurableObject {
  /** The running sync, if any: there is never more than one at a time. */
  private running: Promise<void> | undefined;
  /** The latest board received while a sync ran: synced once that run finishes. */
  private pending: SyncWorkspace | undefined;

  /**
   * Mirror the board into the guild. Never runs two syncs at once: a call during a sync queues the
   * board it was given, and any number of such calls coalesce into one follow-up sync of the latest.
   * Resolves when the guild has caught up with this call's board (or a newer one).
   *
   * Not inside blockConcurrencyWhile: a first sync of a big board, or one waiting out Discord's
   * rate limits, can take well over the 30 seconds after which that resets the object.
   */
  public async sync(workspace: SyncWorkspace) {
    this.pending = workspace;
    this.running ??= this.drain().finally(() => {
      this.running = undefined;
    });
    await this.running;
  }

  private async drain() {
    while (this.pending) {
      const workspace = this.pending;
      this.pending = undefined;
      try {
        // Sequential on purpose: each run must finish before the next starts.
        // oxlint-disable-next-line no-await-in-loop
        await this.syncOnce(workspace);
      } catch (error) {
        // The next trigger retries from scratch; the sync is idempotent.
        console.error("Discord sync failed", error);
      }
    }
  }

  private async syncOnce(workspace: SyncWorkspace) {
    const guildId = workspace.discordGuildId;
    const existing = await this.listChannels(guildId);
    if (existing === undefined) return;

    const rounds = desiredRounds(workspace.rounds);
    const stored = (await this.ctx.storage.get<Record<string, string>>(PUZZLE_CHANNELS_KEY)) ?? {};
    const plan = planSync(
      rounds,
      existing.map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parent_id,
      })),
      stored
    );

    // Puzzle id → channel id, for puzzles whose channel this run settled; saved even if it fails
    // partway, keeping earlier entries for puzzles it didn't reach.
    const puzzleIds = new Set(rounds.flatMap(round => round.puzzles.flatMap(p => p.id ?? [])));
    const settled = new Map<string, string>();

    // Discord API calls below are intentionally sequential: channel creation order determines
    // channel position, and Discord rate-limits channel create/update/delete per guild.
    /* oxlint-disable no-await-in-loop */
    try {
      const categories = new Map(plan.categories);
      for (const round of plan.createCategories) {
        const category = await this.createChannel({guildId, name: round, type: CATEGORY});
        categories.set(round, category.id);
      }

      for (const action of plan.voices) {
        try {
          if (action.kind === "create") {
            const channel = await this.createChannel({
              guildId,
              name: action.name,
              type: VOICE,
              parentId: categories.get(action.round),
            });
            if (action.puzzleId) settled.set(action.puzzleId, channel.id);
            continue;
          }
          if (action.kind === "update") {
            await this.updateChannel(action.channelId, {
              ...(action.name !== undefined && {name: `🧩 ${action.name}`}),
              ...(action.round !== undefined && {parentId: categories.get(action.round) ?? null}),
            });
          }
          if (action.puzzleId) settled.set(action.puzzleId, action.channelId);
        } catch (error) {
          // One puzzle Discord rejects (say, a name it won't take) shouldn't hold up the rest.
          if (!(error instanceof DiscordApiError) || error.status === 429) throw error;
          console.error("Discord sync: skipping a puzzle's channel", error);
        }
      }

      for (const channel of plan.retireVoices) {
        await this.updateChannel(channel.id, {
          name: `✅ ${channel.name}`,
          parentId: channel.parentId,
        });
        await env.DELETE_CHANNEL_AFTER_DELAY_WORKFLOW.create({
          id: crypto.randomUUID(),
          params: {channelId: channel.id, workspaceId: this.ctx.id.name!},
        });
      }
      for (const channelId of plan.deleteVoices) {
        await this.deleteChannel(channelId);
      }
      for (const channelId of plan.deleteCategories) {
        await this.deleteChannel(channelId);
      }
    } finally {
      if (puzzleIds.size > 0 || Object.keys(stored).length > 0) {
        const next: Record<string, string> = {};
        for (const id of puzzleIds) {
          const channelId = settled.get(id) ?? stored[id];
          if (channelId) next[id] = channelId;
        }
        await this.ctx.storage.put(PUZZLE_CHANNELS_KEY, next);
      }
    }
    /* oxlint-enable no-await-in-loop */
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
    const response = await discordRequest(`/guilds/${guildId}/channels`, {
      method: "POST",
      body: {name: `🧩 ${name}`, type, parent_id: parentId ?? null},
    });
    return z.object({id: z.string()}).parse(response);
  }

  /** `name` is the full channel name, prefix included. */
  public async updateChannel(channelId: string, data: {parentId?: string | null; name?: string}) {
    return await discordRequest(`/channels/${channelId}`, {
      method: "PATCH",
      body: {parent_id: data.parentId, name: data.name},
    });
  }

  /** Deletes a channel; one that's already gone counts as deleted. */
  public async deleteChannel(channelId: string) {
    try {
      await discordRequest(`/channels/${channelId}`, {method: "DELETE"});
    } catch (error) {
      if (error instanceof DiscordApiError && error.status === 404) return;
      throw error;
    }
  }

  public async listChannels(guildId: string) {
    const response = await fetchDiscord(`/guilds/${guildId}/channels`);
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
      .transform(as =>
        as.flatMap(a => {
          const parsed = schema.safeParse(a);
          if (parsed.success) {
            return [parsed.data];
          }
          return [];
        })
      )
      .parse(await response.json())
      .filter(channel => channel.name.startsWith("🧩 "))
      .map(channel => {
        // Freshly parsed objects, so mutating in place is safe.
        channel.name = channel.name.replace("🧩 ", "");
        return channel;
      });
  }

  async deleteAllChannels(discordGuildId: string) {
    const channels = await this.listChannels(discordGuildId);
    if (channels === undefined) {
      return;
    }
    for (const channel of channels) {
      // Sequential on purpose: Discord rate-limits channel deletes per guild.
      try {
        // oxlint-disable-next-line no-await-in-loop
        await this.deleteChannel(channel.id);
      } catch (error) {
        // Disconnecting goes ahead even if some channels can't be removed.
        console.error("Discord: couldn't delete a channel", error);
      }
    }
    await this.ctx.storage.delete(PUZZLE_CHANNELS_KEY);
  }
}

type DeleteChannelAfterDelayWorkflowParams = {workspaceId: string; channelId: string};

export class DeleteChannelAfterDelayWorkflow extends WorkflowEntrypoint<
  Env,
  DeleteChannelAfterDelayWorkflowParams
> {
  async run(event: WorkflowEvent<DeleteChannelAfterDelayWorkflowParams>, step: WorkflowStep) {
    await step.sleep("sleep for 10 minutes", "10 minutes");
    const discordClient = env.DISCORD_CLIENT.getByName(event.payload.workspaceId);
    await discordClient.deleteChannel(event.payload.channelId);
  }
}
