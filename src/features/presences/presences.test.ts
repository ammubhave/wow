// @vitest-environment jsdom
import {act, renderHook} from "@testing-library/react";
import {describe, expect, it} from "vite-plus/test";

import {joinPresence, leavePresence, setPresences, usePresences} from "./presences";

const ada = {id: "ada", name: "Ada", email: "ada@example.com", image: null};
const bob = {id: "bob", name: "Bob", email: "bob@example.com", image: null};

describe("presences", () => {
  it("follows joins and leaves at one place", () => {
    const {result} = renderHook(() => usePresences("p1"));
    expect(result.current).toEqual([]);
    act(() => joinPresence({location: "p1", user: ada}));
    act(() => joinPresence({location: "p1", user: ada}));
    act(() => joinPresence({location: "p1", user: bob}));
    expect(result.current.map(u => u.id)).toEqual(["ada", "bob"]);
    act(() => leavePresence({location: "p1", userId: "ada"}));
    expect(result.current.map(u => u.id)).toEqual(["bob"]);
    act(() => leavePresence({location: "p1", userId: "bob"}));
    expect(result.current).toEqual([]);
  });

  it("keeps a place's list when a snapshot doesn't change it, so its rows don't re-render", () => {
    act(() => setPresences({p2: [ada], p3: [bob]}));
    let renders = 0;
    const {result} = renderHook(() => {
      renders++;
      return usePresences("p2");
    });
    const before = result.current;
    const rendersBefore = renders;
    // Same people at p2 (as new objects), someone else elsewhere.
    act(() => setPresences({p2: [{...ada}], p3: [bob, ada]}));
    expect(result.current).toBe(before);
    expect(renders).toBe(rendersBefore);
    act(() => setPresences({p2: [ada, bob]}));
    expect(result.current.map(u => u.id)).toEqual(["ada", "bob"]);
  });

  it("gives an empty place the same empty list every time", () => {
    const {result, rerender} = renderHook(() => usePresences("nowhere"));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
