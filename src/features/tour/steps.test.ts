import {describe, expect, it} from "vite-plus/test";

import {newTourState, parseTourState} from "@/lib/tour-state";
import type {WorkspaceRoomState} from "@/lib/workspace-state";

import {TOURS, type TourContext} from "./steps";

const emptyWorkspace = {rounds: []} as unknown as WorkspaceRoomState;
const ctx = (overrides: Partial<TourContext> = {}): TourContext => ({
  workspace: emptyWorkspace,
  state: newTourState("captain"),
  isPhone: false,
  openPuzzleId: null,
  roundId: "round",
  metaId: "meta",
  puzzleId: "puzzle",
  ...overrides,
});

describe("tours", () => {
  for (const [kind, steps] of Object.entries(TOURS)) {
    it(`${kind}: unique step ids, valid selectors, and a welcome and a finish`, () => {
      const ids = steps.map(step => step.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids[0]).toBe("welcome");
      expect(ids.at(-1)).toBe("done");
      for (const step of steps) {
        for (const c of [ctx(), ctx({isPhone: true})]) {
          const selector = step.target?.(c);
          // A selector the browser would reject would throw here.
          if (selector) expect(() => selector.length && step.body(c)).not.toThrow();
          if (selector) expect(selector).toMatch(/^[[a-z]/);
        }
      }
    });
  }

  it("leaves out puzzle steps when there's no puzzle", () => {
    const live = TOURS.solver.filter(step => !step.skip?.(ctx({puzzleId: null})));
    expect(live.map(step => step.page)).not.toContain("puzzle");
  });

  it("leaves out desktop-only parts on phones", () => {
    const live = TOURS.captain.filter(step => !step.skip?.(ctx({isPhone: true})));
    expect(live.map(step => step.id)).not.toContain("working-on");
  });

  it("the add-round task is done once there's a round", () => {
    const task = TOURS.captain.find(step => step.id === "add-round")!.task!;
    expect(task.isDone(ctx())).toBe(false);
    const withRound = {rounds: [{id: "r", puzzles: []}]} as unknown as WorkspaceRoomState;
    expect(task.isDone(ctx({workspace: withRound}))).toBe(true);
  });
});

describe("parseTourState", () => {
  it("reads saved state and rejects anything else", () => {
    expect(parseTourState(newTourState("solver"))).toEqual(newTourState("solver"));
    expect(parseTourState(null)).toBeNull();
    expect(parseTourState({kind: "nope"})).toBeNull();
  });
});
