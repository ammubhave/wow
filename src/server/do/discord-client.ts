import {
  DurableObject,
  env,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {
  CATEGORY,
  desiredRounds,
  planRetry,
  planSync,
  retryAfterSeconds,
  type SyncRetry,
  type SyncRound,
  VOICE,
} from "../discord-sync-plan";
import {discordBoard} from "../router/services/discord";

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

/** Storage key for a failed sync waiting on its retry (the alarm): a SyncRetry. */
const RETRY_KEY = "syncRetry";

/**
 * Whether trying again later could help: Discord being down or rate-limiting us, or the network.
 * Not Discord refusing (the bot removed from the server, say), which a retry won't change.
 */
const isRetryable = (error: unknown) =>
  !(error instanceof DiscordApiError) || error.status === 429 || error.status >= 500;

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
    let workspace: SyncWorkspace | undefined;
    let failure: unknown;
    while (this.pending) {
      workspace = this.pending;
      this.pending = undefined;
      failure = undefined;
      try {
        // Sequential on purpose: each run must finish before the next starts.
        // oxlint-disable-next-line no-await-in-loop
        await this.syncOnce(workspace);
      } catch (error) {
        console.error("Discord sync failed", error);
        failure = error;
      }
    }
    // Only the last run counts: it synced the latest board, so it covers any that failed before.
    if (workspace) await this.settle(workspace.discordGuildId, failure);
  }

  /**
   * After a sync: if it failed for a reason that may pass, tries again later (an alarm, so it
   * happens even if nobody touches the board, and survives this object being restarted). The sync
   * is idempotent, so a retry just syncs the board as it is then.
   */
  private async settle(guildId: string, failure: unknown) {
    const current = await this.ctx.storage.get<SyncRetry>(RETRY_KEY);
    const step = planRetry(
      current,
      guildId,
      failure === undefined ? "none" : isRetryable(failure) ? "passing" : "lasting"
    );
    if (step.kind === "retry") {
      await this.ctx.storage.put(RETRY_KEY, step.retry);
      await this.ctx.storage.setAlarm(Date.now() + step.delaySeconds * 1000);
      return;
    }
    if (step.kind === "giveUp") {
      console.error(`Discord sync of ${guildId}: giving up after ${step.attempts} retries`);
    }
    if (current) {
      await this.ctx.storage.delete(RETRY_KEY);
      await this.ctx.storage.deleteAlarm();
    }
  }

  /** Retrying a failed sync: with the board as it is now, if the server still mirrors one. */
  async alarm() {
    const retry = await this.ctx.storage.get<SyncRetry>(RETRY_KEY);
    if (!retry) return;
    const board = await discordBoard({discordGuildId: retry.guildId});
    if (!board) {
      // Disconnected, or switched to WOW calls, since: nothing to sync.
      await this.ctx.storage.delete(RETRY_KEY);
      return;
    }
    await this.sync(board);
  }

  private async syncOnce(workspace: SyncWorkspace) {
    const guildId = workspace.discordGuildId;
    const existing = await this.channels(guildId);

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

  /** WOW's channels in the server, or undefined if Discord didn't list them. */
  public async listChannels(guildId: string) {
    return await this.channels(guildId).catch((error: unknown) => {
      console.error("Couldn't list Discord channels", error);
      return undefined;
    });
  }

  /** WOW's channels in the server (names without the 🧩); throws a DiscordApiError if it can't. */
  private async channels(guildId: string) {
    const response = await discordRequest(`/guilds/${guildId}/channels`);
    const channelSchema = z.object({
      id: z.string(),
      name: z.string(),
      type: z.number(),
      parent_id: z.string().nullable(),
    });
    return z
      .array(z.any())
      .transform(as =>
        as.flatMap(a => {
          const parsed = channelSchema.safeParse(a);
          if (parsed.success) {
            return [parsed.data];
          }
          return [];
        })
      )
      .parse(response)
      .filter(channel => channel.name.startsWith("🧩 "))
      .map(channel => {
        // Freshly parsed objects, so mutating in place is safe.
        channel.name = channel.name.replace("🧩 ", "");
        return channel;
      });
  }

  /** Forgets which channel is whose (when the server is disconnected from its workspace). */
  public async forgetChannels() {
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
    // A step, so a Discord outage or rate limit just then is retried instead of leaving the
    // channel behind. (`workspaceId` is the Discord server's id: the DiscordClient's name.)
    await step.do(
      "delete the channel",
      {retries: {limit: 6, delay: "30 seconds", backoff: "exponential"}},
      () =>
        env.DISCORD_CLIENT.getByName(event.payload.workspaceId).deleteChannel(
          event.payload.channelId
        )
    );
  }
}

type DiscordDisconnectParams = {guildId: string};

/**
 * Removes WOW's channels from a Discord server that was disconnected from its workspace. The
 * workspace is unlinked first (workspaces.discord.disconnect), so it doesn't wait for this; each
 * channel is its own retried step, so Discord's rate limits or an outage can't leave some behind.
 * Stops if the server is linked to a workspace again meanwhile: its channels are wanted again.
 */
export class DiscordDisconnectWorkflow extends WorkflowEntrypoint<Env, DiscordDisconnectParams> {
  async run(event: WorkflowEvent<DiscordDisconnectParams>, step: WorkflowStep) {
    const {guildId} = event.payload;
    const client = () => env.DISCORD_CLIENT.getByName(guildId);
    const channelIds = await step.do("list WOW's channels", RETRIES, async () => {
      const channels = await client().listChannels(guildId);
      // Discord didn't answer (or the bot was removed from the server: then this keeps failing,
      // and there's nothing WOW can delete anyway).
      if (channels === undefined) throw new Error(`Couldn't list the channels of ${guildId}`);
      // Channels inside categories first, so a category is empty when it goes.
      return channels
        .toSorted((a, b) => Number(a.parent_id === null) - Number(b.parent_id === null))
        .map(channel => channel.id);
    });
    for (const channelId of channelIds) {
      // oxlint-disable-next-line no-await-in-loop -- one at a time: Discord rate-limits deletes per server.
      const linked = await step.do(`check ${channelId}`, () => isLinked(guildId));
      if (linked) return;
      // oxlint-disable-next-line no-await-in-loop -- as above.
      await step.do(`delete ${channelId}`, RETRIES, () => client().deleteChannel(channelId));
    }
    await step.do("forget the channels", async () => {
      if (!(await isLinked(guildId))) await client().forgetChannels();
    });
  }
}

const RETRIES = {retries: {limit: 6, delay: "30 seconds", backoff: "exponential"}} as const;

/** Whether a workspace uses this Discord server (again). */
async function isLinked(guildId: string) {
  const workspace = await db
    .select({id: schema.organization.id})
    .from(schema.organization)
    .where(eq(schema.organization.discordGuildId, guildId))
    .get();
  return workspace !== undefined;
}
