import {generateKeyBetween, generateNKeysBetween} from "fractional-indexing";
import {z} from "zod";

/**
 * The order of rounds and puzzles on the blackboard. Each one has a `position`: a fractional index
 * (a string that sorts between its neighbours), so moving one changes only that one. Items that were
 * never moved have no position and come after the placed ones, oldest first (as the board always
 * showed them).
 */

type Ordered = {id: string; position: string | null; createdAt: Date | string | number};

const time = (value: Ordered["createdAt"]) => new Date(value).getTime();

/** Board order: placed items by position, then unplaced ones by age (then id, to be stable). */
export function compareBoardOrder(a: Ordered, b: Ordered) {
  if (a.position !== b.position) {
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    // Fractional indexes compare as plain strings (not locale-aware).
    return a.position < b.position ? -1 : 1;
  }
  return time(a.createdAt) - time(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Where to put an item among its new siblings: before or after one of them, or last. */
export const placeSchema = z.union([
  z.object({before: z.string()}),
  z.object({after: z.string()}),
  z.object({end: z.literal(true)}),
]);
export type Place = z.infer<typeof placeSchema>;

/**
 * The positions to write so `id` sits at `place` among `siblings` (its new list, in any order; it
 * may include `id` itself). Siblings that have no position yet are given one first, in their
 * current order, so the new position has neighbours to sit between.
 */
export function placeAmong(siblings: Ordered[], id: string, place: Place) {
  const list = siblings.filter(s => s.id !== id).toSorted(compareBoardOrder);
  const updates = new Map<string, string>();

  const placeUnplaced = () => {
    const first = list.findIndex(s => s.position === null);
    if (first === -1) return;
    const keys = generateNKeysBetween(list[first - 1]?.position ?? null, null, list.length - first);
    keys.forEach((key, i) => {
      const sibling = list[first + i]!;
      list[first + i] = {...sibling, position: key};
      updates.set(sibling.id, key);
    });
  };
  placeUnplaced();

  const target =
    "end" in place
      ? -1
      : list.findIndex(s => s.id === ("before" in place ? place.before : place.after));
  const index = target === -1 ? list.length : "before" in place ? target : target + 1;
  let key: string;
  try {
    key = generateKeyBetween(list[index - 1]?.position ?? null, list[index]?.position ?? null);
  } catch {
    // Two siblings ended up with the same position (moved at the same moment): renumber the list.
    const keys = generateNKeysBetween(null, null, list.length + 1);
    list.forEach((sibling, i) => {
      const fresh = keys[i < index ? i : i + 1]!;
      list[i] = {...sibling, position: fresh};
      updates.set(sibling.id, fresh);
    });
    key = keys[index]!;
  }
  updates.set(id, key);
  return updates;
}
