import {runDurableObjectAlarm, runInDurableObject} from "cloudflare:test";
import {env} from "cloudflare:workers";
import {afterEach, beforeAll, describe, expect, it, vi} from "vite-plus/test";

import type {SyncRetry} from "@/server/discord-sync-plan";
import type {DiscordClient} from "@/server/do/discord-client";

import {migrate} from "./db";

beforeAll(migrate);
afterEach(() => vi.restoreAllMocks());

/** A workspace mirrored to its own Discord server (a new one per test), with no rounds yet. */
async function connectedWorkspace() {
  const guildId = String(Math.floor(Math.random() * 1e15));
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO organization (id, name, slug, created_at, discord_guild_id, voice_tool)
     VALUES (?, 'Team', ?, ?, ?, 'discord')`
  )
    .bind(id, `team-${id.slice(0, 8)}`, Date.now(), guildId)
    .run();
  return {id, guildId, stub: env.DISCORD_CLIENT.getByName(guildId)};
}

/** Discord answering every request with `status` (its channel list is empty when it's up). */
function discordAnswers(status: number) {
  // A fresh spy each time (spying again would return the same one, calls and all).
  vi.restoreAllMocks();
  return vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://discord.com/")) throw new Error(`Unexpected fetch: ${url}`);
    return status === 200
      ? Response.json([])
      : new Response(JSON.stringify({message: "nope"}), {status});
  });
}

const retryState = (stub: DurableObjectStub<DiscordClient>) =>
  runInDurableObject(stub, async (_client: DiscordClient, state) => ({
    retry: await state.storage.get<SyncRetry>("syncRetry"),
    alarm: await state.storage.getAlarm(),
  }));

describe("Discord sync retries", () => {
  it("retries a sync that failed while Discord was down, from an alarm", async () => {
    const {guildId, stub} = await connectedWorkspace();
    discordAnswers(503);
    const before = Date.now();
    await stub.sync({discordGuildId: guildId, rounds: []});

    const failed = await retryState(stub);
    expect(failed.retry).toEqual({guildId, attempts: 1});
    // The first retry is 30 seconds out.
    expect(failed.alarm! - before).toBeGreaterThanOrEqual(29_000);
    expect(failed.alarm! - before).toBeLessThan(40_000);

    // Discord is back: the alarm syncs the board as it is now, and nothing is left scheduled.
    const fetch = discordAnswers(200);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      expect.anything()
    );
    expect(await retryState(stub)).toEqual({retry: undefined, alarm: null});
  });

  it("backs off when the retry fails too", async () => {
    const {guildId, stub} = await connectedWorkspace();
    discordAnswers(500);
    await stub.sync({discordGuildId: guildId, rounds: []});
    const before = Date.now();
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const state = await retryState(stub);
    expect(state.retry).toEqual({guildId, attempts: 2});
    expect(state.alarm! - before).toBeGreaterThanOrEqual(59_000);
  });

  it("doesn't retry when Discord refuses (the bot was removed, say)", async () => {
    const {guildId, stub} = await connectedWorkspace();
    discordAnswers(403);
    await stub.sync({discordGuildId: guildId, rounds: []});
    expect(await retryState(stub)).toEqual({retry: undefined, alarm: null});
  });

  it("drops the retry if the server was disconnected meanwhile", async () => {
    const {id, guildId, stub} = await connectedWorkspace();
    discordAnswers(503);
    await stub.sync({discordGuildId: guildId, rounds: []});
    await env.DB.prepare("UPDATE organization SET discord_guild_id = NULL WHERE id = ?")
      .bind(id)
      .run();

    const fetch = discordAnswers(200);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect((await retryState(stub)).retry).toBeUndefined();
  });
});
