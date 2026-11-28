import {runInDurableObject} from "cloudflare:test";
import {env} from "cloudflare:workers";
import {v7 as uuidv7} from "uuid";
import {afterEach, beforeAll, describe, expect, it, vi} from "vite-plus/test";

import {NOTIFICATION_USER_HEADER, type NotificationRoom} from "@/server/do/notification";
import type {NotificationMessage, WorkspaceNotification} from "@/server/notifications";

import {migrate} from "./db";
import {openSocket} from "./socket";

beforeAll(migrate);
afterEach(() => vi.restoreAllMocks());

type History = Extract<NotificationMessage, {type: "history"}>;
type ReadState = Extract<NotificationMessage, {type: "readState"}>;
type Older = Extract<NotificationMessage, {type: "older"}>;

/** A workspace's notification room, with a socket for each person. */
function room() {
  const workspaceId = crypto.randomUUID();
  const stub = env.NOTIFICATION_ROOMS.getByName(workspaceId);
  const connect = (userId: string) =>
    openSocket(stub, "https://wow.test/", {[NOTIFICATION_USER_HEADER]: userId});
  return {workspaceId, stub, connect};
}

/** What a test notification says (a mention's text, a solve's message). */
const label = (n: WorkspaceNotification) =>
  n.type === "mention" ? n.text : n.type === "solved" ? n.message : n.type;

const mention = (toUserIds: string[], text: string) =>
  ({
    type: "mention",
    toUserIds,
    from: {id: "carol", name: "Carol"},
    puzzleId: null,
    puzzleName: "Team chat",
    text,
  }) as const;

describe("notifications", () => {
  it("shows everyone a solve, but a mention only to whoever was mentioned", async () => {
    const {workspaceId, stub, connect} = room();
    const ada = await connect("ada");
    const bob = await connect("bob");
    await ada.next<History>(m => m.type === "history");
    await bob.next<History>(m => m.type === "history");

    await stub.broadcast(workspaceId, {
      type: "solved",
      message: "Lighthouse was solved!",
      puzzleId: "p1",
      puzzleName: "Lighthouse",
      answer: "BEACON",
      isMeta: false,
      by: null,
    });
    await stub.broadcast(workspaceId, mention(["ada"], "@Ada look at this"));

    const adaGot = [
      await ada.next<WorkspaceNotification>(m => m.type === "solved"),
      await ada.next<WorkspaceNotification>(m => m.type === "mention"),
    ];
    expect(adaGot.map(n => n.type)).toEqual(["solved", "mention"]);
    await bob.next<WorkspaceNotification>(m => m.type === "solved");
    await expect(bob.next(m => m.type === "mention", 300)).rejects.toThrow();

    // Someone arriving later gets the same history, newest first, mentions only if theirs.
    const bobLater = await connect("bob");
    const history = await bobLater.next<History>(m => m.type === "history");
    expect(history.notifications.map(n => n.type)).toEqual(["solved"]);
    const adaLater = await connect("ada");
    const adaHistory = await adaLater.next<History>(m => m.type === "history");
    expect(adaHistory.notifications.map(n => n.type)).toEqual(["mention", "solved"]);
    for (const socket of [ada, bob, bobLater, adaLater]) socket.close();
  });

  it("keeps each person's read state, and shares it with their other tabs", async () => {
    const {workspaceId, stub, connect} = room();
    await stub.broadcast(workspaceId, mention(["ada"], "one"));
    await stub.broadcast(workspaceId, mention(["ada"], "two"));

    const tab1 = await connect("ada");
    const tab2 = await connect("ada");
    const history = await tab1.next<History>(m => m.type === "history");
    const initial = await tab1.next<ReadState>(m => m.type === "readState");
    expect(initial).toMatchObject({seenAt: 0, readIds: []});
    await tab2.next<ReadState>(m => m.type === "readState");

    const newest = history.notifications[0]!;
    tab1.send({type: "read", ids: [newest.id]});
    expect(await tab2.next<ReadState>(m => m.type === "readState")).toMatchObject({
      readIds: [newest.id],
    });

    tab1.send({type: "readAll"});
    const all = await tab2.next<ReadState>(m => m.type === "readState");
    expect(all.readIds).toEqual([]);
    expect(all.seenAt).toBe(newest.timestamp);

    // Remembered for the next connection (another browser), but not for someone else.
    const laptop = await connect("ada");
    await laptop.next<History>(m => m.type === "history");
    expect(await laptop.next<ReadState>(m => m.type === "readState")).toMatchObject({
      seenAt: newest.timestamp,
    });
    const bob = await connect("bob");
    await bob.next<History>(m => m.type === "history");
    expect(await bob.next<ReadState>(m => m.type === "readState")).toMatchObject({seenAt: 0});
    for (const socket of [tab1, tab2, laptop, bob]) socket.close();
  });

  it("refuses a connection that doesn't say whose it is", async () => {
    const {stub} = room();
    const response = await stub.fetch("https://wow.test/", {headers: {Upgrade: "websocket"}});
    expect(response.status).toBe(400);
  });

  it("pages back through older notifications, each person's own mentions only", async () => {
    const {stub, connect} = room();
    // 250 solves, with a mention of Ada every 10th (stored as made long ago, oldest first).
    await runInDurableObject(stub, (r: NotificationRoom) => {
      for (let i = 1; i <= 250; i++) {
        const at = 1_700_000_000_000 + i;
        const common = {id: uuidv7({msecs: at}), timestamp: at};
        r.save(
          i % 10 === 0
            ? {...common, ...mention(["ada"], `#${i}`)}
            : {
                ...common,
                type: "solved",
                message: `#${i}`,
                puzzleId: "p",
                puzzleName: "P",
                answer: "A",
                isMeta: false,
                by: null,
              }
        );
      }
    });

    const ada = await connect("ada");
    const first = await ada.next<History>(m => m.type === "history");
    expect(first.notifications).toHaveLength(100);
    expect(label(first.notifications[0]!)).toBe("#250");
    expect(first.hasMore).toBe(true);
    const all = [...first.notifications];
    let hasMore = first.hasMore;
    while (hasMore) {
      ada.send({type: "older", before: all.at(-1)!.id});
      // oxlint-disable-next-line no-await-in-loop
      const page = await ada.next<Older>(m => m.type === "older");
      all.push(...page.notifications);
      hasMore = page.hasMore;
    }
    expect(all.map(label)).toEqual(Array.from({length: 250}, (_, i) => `#${250 - i}`));

    // Bob never gets Ada's mentions, in any page.
    const bob = await connect("bob");
    const bobFirst = await bob.next<History>(m => m.type === "history");
    const bobAll = [...bobFirst.notifications];
    hasMore = bobFirst.hasMore;
    while (hasMore) {
      bob.send({type: "older", before: bobAll.at(-1)!.id});
      // oxlint-disable-next-line no-await-in-loop
      const page = await bob.next<Older>(m => m.type === "older");
      bobAll.push(...page.notifications);
      hasMore = page.hasMore;
    }
    expect(bobAll).toHaveLength(225);
    expect(bobAll.some(n => n.type === "mention")).toBe(false);
    ada.close();
    bob.close();
  });

  it("keeps the newest 5000", async () => {
    const {workspaceId, stub} = room();
    await runInDurableObject(stub, (r: NotificationRoom) => {
      for (let i = 1; i <= 5010; i++) {
        const at = 1_700_000_000_000 + i;
        r.save({...mention(["ada"], `#${i}`), id: uuidv7({msecs: at}), timestamp: at});
      }
    });
    vi.spyOn(Math, "random").mockReturnValue(0);
    await stub.broadcast(workspaceId, mention(["ada"], "newest"));
    const kept = await runInDurableObject(stub, (_r: NotificationRoom, state) =>
      state.storage.sql
        .exec<{n: number; oldest: string}>(
          "SELECT count(*) AS n, (SELECT json_extract(data, '$.text') FROM notification ORDER BY id LIMIT 1) AS oldest FROM notification"
        )
        .one()
    );
    // 5011 made: the 11 oldest went.
    expect(kept).toEqual({n: 5000, oldest: "#12"});
  });
});
