import {runInDurableObject} from "cloudflare:test";
import {env} from "cloudflare:workers";
import {afterEach, beforeAll, describe, expect, it, vi} from "vite-plus/test";

import type {WorkspaceRoom} from "@/server/do/workspace";

import {migrate} from "./db";

beforeAll(migrate);
afterEach(() => vi.restoreAllMocks());

const HOUR = 60 * 60 * 1000;
const workspaceRoom = () => env.WORKSPACE_ROOMS.getByName(crypto.randomUUID());

describe("voice session records", () => {
  it("remembers who created each SFU session", async () => {
    const stub = workspaceRoom();
    await stub.registerVoiceSession("s1", "ada");
    await stub.registerVoiceSession("s2", "bob");
    await runInDurableObject(stub, (room: WorkspaceRoom) => {
      expect(room.voiceSessionOwner("s1")).toBe("ada");
      expect(room.voiceSessionOwner("s2")).toBe("bob");
      expect(room.voiceSessionOwner("s3")).toBeUndefined();
    });
  });

  it("drops records too old to still be in a call", async () => {
    const stub = workspaceRoom();
    await stub.registerVoiceSession("old", "ada");
    await runInDurableObject(stub, (_room: WorkspaceRoom, state) => {
      state.storage.sql.exec(
        "UPDATE voice_session SET created_at = ? WHERE id = 'old'",
        Date.now() - 49 * HOUR
      );
    });
    vi.spyOn(Math, "random").mockReturnValue(0);
    await stub.registerVoiceSession("new", "ada");
    await runInDurableObject(stub, (room: WorkspaceRoom) => {
      expect(room.voiceSessionOwner("old")).toBeUndefined();
      expect(room.voiceSessionOwner("new")).toBe("ada");
    });
  });
});
