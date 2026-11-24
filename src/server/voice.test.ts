import {describe, expect, it} from "vite-plus/test";

import {voiceUsageSince} from "./voice";

describe("voiceUsageSince", () => {
  const at = Date.UTC(2026, 10, 23, 12);

  it("counts each stream every other person receives", () => {
    const sample = {
      at,
      rooms: {lobby: {people: 4, cameras: 1, screens: 2}, p1: {people: 1, cameras: 1, screens: 0}},
    };
    expect(voiceUsageSince(sample, at + 10_000)).toEqual([
      {room: "lobby", kind: "audio", streamSeconds: 10 * 4 * 3},
      {room: "lobby", kind: "camera", streamSeconds: 10 * 1 * 3},
      {room: "lobby", kind: "screen", streamSeconds: 10 * 2 * 3},
      // Alone in a room: nobody receives anything.
    ]);
  });

  it("skips periods under a second, and no sample", () => {
    const sample = {at, rooms: {lobby: {people: 2, cameras: 0, screens: 0}}};
    expect(voiceUsageSince(sample, at + 999)).toEqual([]);
    expect(voiceUsageSince(undefined, at + 10_000)).toEqual([]);
  });
});
