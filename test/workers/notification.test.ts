import {env} from "cloudflare:workers";
import {beforeAll, describe, expect, it} from "vite-plus/test";

import {NOTIFICATION_USER_HEADER} from "@/server/do/notification";
import type {NotificationMessage, WorkspaceNotification} from "@/server/notifications";

import {migrate} from "./db";
import {openSocket} from "./socket";

beforeAll(migrate);

type History = Extract<NotificationMessage, {type: "history"}>;
type ReadState = Extract<NotificationMessage, {type: "readState"}>;

/** A workspace's notification room, with a socket for each person. */
function room() {
  const workspaceId = crypto.randomUUID();
  const stub = env.NOTIFICATION_ROOMS.getByName(workspaceId);
  const connect = (userId: string) =>
    openSocket(stub, "https://wow.test/", {[NOTIFICATION_USER_HEADER]: userId});
  return {workspaceId, stub, connect};
}

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
});
