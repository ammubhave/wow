import {listDurableObjectIds, runInDurableObject} from "cloudflare:test";
import {env} from "cloudflare:workers";
import {v7 as uuidv7} from "uuid";
import {beforeAll, describe, expect, it} from "vite-plus/test";

import type {ChatMessage, ChatRoom, ChatRoomReceivedMessage} from "@/server/do/chat";
import {READ_ONLY_HEADER} from "@/server/workspace-access";

import {migrate} from "./db";
import {openSocket} from "./socket";

beforeAll(migrate);

type Snapshot = Extract<ChatRoomReceivedMessage, {type: "snapshot"}>;
type History = Extract<ChatRoomReceivedMessage, {type: "history"}>;

/** A puzzle's chat room with `count` messages already in it, "#1" the oldest. */
async function roomWith(count: number) {
  const puzzleId = crypto.randomUUID();
  const stub = env.CHAT_ROOMS.getByName(puzzleId);
  // uuidv7 ids like the room makes, from the past (so they sort before anything sent now).
  const ids = Array.from({length: count}, (_, i) => uuidv7({msecs: 1_700_000_000_000 + i}));
  await runInDurableObject(stub, (room: ChatRoom) => {
    for (let i = 1; i <= count; i++) {
      room.save({
        id: ids[i - 1]!,
        name: "Ada",
        userId: "ada",
        text: `#${i}`,
        timestamp: 1_700_000_000_000 + i,
        reactions: {},
      });
    }
  });
  return {stub, ids, url: `https://wow.test/api/chat/${puzzleId}`};
}

const texts = (messages: ChatMessage[]) => messages.map(m => m.text);

describe("chat history", () => {
  it("opens on the newest page and pages back to the first message", async () => {
    const {stub, url} = await roomWith(250);
    const socket = await openSocket(stub, url);
    const snapshot = await socket.next<Snapshot>(m => m.type === "snapshot");
    expect(snapshot.messages).toHaveLength(100);
    expect(snapshot.messages[0]?.text).toBe("#151");
    expect(snapshot.messages.at(-1)?.text).toBe("#250");
    expect(snapshot.hasMore).toBe(true);

    const all = [...snapshot.messages];
    let hasMore = snapshot.hasMore;
    while (hasMore) {
      socket.send({type: "history", before: all[0]!.id});
      // oxlint-disable-next-line no-await-in-loop
      const page = await socket.next<History>(m => m.type === "history");
      all.unshift(...page.messages);
      hasMore = page.hasMore;
    }
    expect(all).toHaveLength(250);
    expect(texts(all)).toEqual(Array.from({length: 250}, (_, i) => `#${i + 1}`));
    socket.close();
  });

  it("says there's nothing older when the whole chat fits", async () => {
    const {stub, url} = await roomWith(100);
    const socket = await openSocket(stub, url);
    const snapshot = await socket.next<Snapshot>(m => m.type === "snapshot");
    expect(snapshot.messages).toHaveLength(100);
    expect(snapshot.hasMore).toBe(false);
    socket.close();
  });

  it("lets an archived (read-only) room scroll back, but not post", async () => {
    const {stub, url} = await roomWith(150);
    const socket = await openSocket(stub, url, {[READ_ONLY_HEADER]: "1"});
    const snapshot = await socket.next<Snapshot>(m => m.type === "snapshot");
    socket.send({type: "history", before: snapshot.messages[0]!.id});
    const page = await socket.next<History>(m => m.type === "history");
    expect(texts(page.messages)).toEqual(Array.from({length: 50}, (_, i) => `#${i + 1}`));
    expect(page.hasMore).toBe(false);

    socket.send({type: "send", text: "hello from the archive"});
    await expect(socket.next(m => m.type === "message", 500)).rejects.toThrow();
    socket.close();
  });
});

describe("chat messages", () => {
  it("saves a sent message, shares it, and keeps pins in the order they were pinned", async () => {
    const {stub, ids, url} = await roomWith(3);
    const socket = await openSocket(stub, url);
    await socket.next<Snapshot>(m => m.type === "snapshot");

    socket.send({type: "send", text: "new one"});
    const sent = await socket.next<{message: ChatMessage}>(m => m.type === "message" && m.isNew);
    expect(sent.message.text).toBe("new one");

    for (const [messageId, pinned] of [
      [ids[2]!, true],
      [ids[0]!, true],
      [sent.message.id, true],
      [ids[2]!, false],
    ] as const) {
      socket.send({type: "pin", messageId, pinned});
      // oxlint-disable-next-line no-await-in-loop
      await socket.next(m => m.type === "message" && m.message.id === messageId);
    }
    socket.close();

    // A new visitor sees the message and the pins, oldest pin first.
    const again = await openSocket(stub, url);
    const snapshot = await again.next<Snapshot>(m => m.type === "snapshot");
    expect(texts(snapshot.messages).at(-1)).toBe("new one");
    expect(texts(snapshot.pinned)).toEqual(["#1", "new one"]);
    again.close();
  });

  it("answers an Eggö command with Eggö's message", async () => {
    const {stub, url} = await roomWith(0);
    const socket = await openSocket(stub, url);
    await socket.next<Snapshot>(m => m.type === "snapshot");
    socket.send({type: "send", text: "!help please"});
    const mine = await socket.next<{message: ChatMessage}>(m => m.type === "message" && m.isNew);
    const eggo = await socket.next<{message: ChatMessage}>(m => m.type === "message" && m.isNew);
    expect(mine.message.reactions).toEqual({like: 1});
    expect(eggo.message).toMatchObject({name: "Eggö", text: "!help"});
    socket.close();
  });

  it("deletes everything when the puzzle is deleted", async () => {
    const {stub} = await roomWith(5);
    const puzzleId = (await runInDurableObject(stub, (_room: ChatRoom, state) => state.id.name))!;
    await stub.clear(puzzleId);
    const left = await runInDurableObject(stub, (_room: ChatRoom, state) =>
      state.storage.sql
        .exec<{name: string}>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .toArray()
    );
    expect(left.filter(t => !t.name.startsWith("_cf"))).toEqual([]);
    expect((await listDurableObjectIds(env.CHAT_ROOMS)).length).toBeGreaterThan(0);
  });
});
