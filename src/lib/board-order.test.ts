import {expect, test} from "vite-plus/test";

import {compareBoardOrder, placeAmong} from "./board-order";

const item = (id: string, position: string | null, createdAt = 0) => ({id, position, createdAt});
const order = (items: ReturnType<typeof item>[]) =>
  items.toSorted(compareBoardOrder).map(i => i.id);
const apply = (items: ReturnType<typeof item>[], updates: Map<string, string>) =>
  items.map(i => ({...i, position: updates.get(i.id) ?? i.position}));

test("unplaced items keep their age order, after placed ones", () => {
  expect(
    order([item("c", null, 3), item("a", null, 1), item("x", "a0"), item("b", null, 2)])
  ).toEqual(["x", "a", "b", "c"]);
});

test("placing among unplaced siblings keeps their order and changes only what's needed", () => {
  const items = [item("a", null, 1), item("b", null, 2), item("c", null, 3)];
  const updates = placeAmong(items, "c", {before: "a"});
  expect(order(apply(items, updates))).toEqual(["c", "a", "b"]);
  // Once placed, a second move only rewrites the moved item.
  const placed = apply(items, updates);
  const next = placeAmong(placed, "a", {after: "b"});
  expect([...next.keys()]).toEqual(["a"]);
  expect(order(apply(placed, next))).toEqual(["c", "b", "a"]);
});

test("moving into a new list, first, last, and after a missing sibling (goes last)", () => {
  const items = [item("a", "a0"), item("b", "a1")];
  const moved = item("z", null, 9);
  expect(order(apply([...items, moved], placeAmong(items, "z", {before: "a"})))).toEqual([
    "z",
    "a",
    "b",
  ]);
  expect(order(apply([...items, moved], placeAmong(items, "z", {end: true})))).toEqual([
    "a",
    "b",
    "z",
  ]);
  expect(order(apply([...items, moved], placeAmong(items, "z", {after: "gone"})))).toEqual([
    "a",
    "b",
    "z",
  ]);
});

test("is the same when applied again (optimistic recipes rely on this)", () => {
  const items = [item("a", "a0"), item("b", "a1"), item("c", "a2")];
  const once = apply(items, placeAmong(items, "c", {after: "a"}));
  expect(apply(once, placeAmong(once, "c", {after: "a"}))).toEqual(once);
});

test("renumbers siblings that share a position", () => {
  const items = [item("a", "a0"), item("b", "a0"), item("c", "a1")];
  const result = apply(items, placeAmong(items, "c", {after: "a"}));
  expect(order(result)).toEqual(["a", "c", "b"]);
  expect(new Set(result.map(i => i.position)).size).toBe(3);
});
