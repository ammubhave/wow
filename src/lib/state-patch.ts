/**
 * Patches between two versions of a JSON value (the workspace room state), so a change to one
 * puzzle sends that puzzle instead of the whole board.
 *
 * `applyPatch(a, diffState(a, b))` is exactly `b`: same values, same key order, same array order
 * (the tests check this on random states). Both sides compute everything about `a` (its keys, its
 * items' ids) from the same `a`, so the patch only has to carry what's different. Anything left
 * unchanged keeps its object identity, so React re-renders only what changed.
 *
 * Values must be plain JSON (what `JSON.parse` returns).
 */

export type Json = null | boolean | number | string | Json[] | {[key: string]: Json};

export type Patch =
  /** Replace the value. */
  | {t: "v"; v: Json}
  /**
   * An array of objects with unique string ids (see `itemId`): the new order (`ids`, omitted when unchanged),
   * and a patch for each new or changed item. Items not listed in `ids` were removed.
   */
  | {t: "a"; ids?: string[]; u: [string, Patch][]}
  /** An object: the new key order (`keys`, omitted when unchanged) and a patch per changed key. */
  | {t: "o"; keys?: string[]; c: [string, Patch][]};

const isObject = (value: Json): value is {[key: string]: Json} =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Deep equality of JSON values, including key order (it affects the serialized form). */
export function jsonEqual(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!jsonEqual(a[i]!, b[i]!)) return false;
    return true;
  }
  if (isObject(a)) {
    if (!isObject(b)) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      const key = aKeys[i]!;
      if (key !== bKeys[i] || !jsonEqual(a[key]!, b[key]!)) return false;
    }
    return true;
  }
  return false;
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, i) => item === b[i]);

/**
 * An item's id: its `id`, or else its first field's `id` (a joined row, like an activity log entry
 * `{activity_log_entry: {id, ...}, user: {...}}`).
 */
function itemId(item: {[key: string]: Json}): string | undefined {
  if (typeof item.id === "string") return item.id;
  if (Object.hasOwn(item, "id")) return undefined;
  const first = Object.values(item)[0];
  return first !== undefined && isObject(first) && typeof first.id === "string"
    ? first.id
    : undefined;
}

/** The items' ids, when every item is an object with a unique string id; otherwise null. */
function itemIds(items: Json[]): string[] | null {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!isObject(item)) return null;
    const id = itemId(item);
    if (id === undefined || seen.has(id)) return null;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/** How `a` becomes `b`, or undefined when they're the same. */
export function diffState(a: Json, b: Json): Patch | undefined {
  if (jsonEqual(a, b)) return undefined;
  if (Array.isArray(a) && Array.isArray(b)) {
    const aIds = itemIds(a);
    const bIds = itemIds(b);
    // Keyed by id only when both sides are lists of uniquely-identified objects (and not empty:
    // a replace is just as small, and `[]` says nothing about what the items are).
    if (aIds && bIds && aIds.length > 0 && bIds.length > 0) {
      const before = new Map(aIds.map((id, i) => [id, a[i]!]));
      const u: [string, Patch][] = [];
      bIds.forEach((id, i) => {
        const old = before.get(id);
        const patch = old === undefined ? {t: "v" as const, v: b[i]!} : diffState(old, b[i]!);
        if (patch) u.push([id, patch]);
      });
      return sameList(aIds, bIds) ? {t: "a", u} : {t: "a", ids: bIds, u};
    }
    return {t: "v", v: b};
  }
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    const c: [string, Patch][] = [];
    for (const key of bKeys) {
      const patch = Object.hasOwn(a, key)
        ? diffState(a[key]!, b[key]!)
        : {t: "v" as const, v: b[key]!};
      if (patch) c.push([key, patch]);
    }
    return sameList(aKeys, bKeys) ? {t: "o", c} : {t: "o", keys: bKeys, c};
  }
  return {t: "v", v: b};
}

/** `a` with `diffState(a, b)` applied: `b`. Doesn't modify `a`; unchanged parts are shared with it. */
export function applyPatch(a: Json, patch: Patch): Json {
  if (patch.t === "v") return patch.v;
  if (patch.t === "a") {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- diffState made an "a" patch from this list.
    const items = a as Json[];
    const ids = itemIds(items)!;
    const before = new Map(ids.map((id, i) => [id, items[i]!]));
    const changes = new Map(patch.u);
    return (patch.ids ?? ids).map(id => {
      const change = changes.get(id);
      const item = before.get(id);
      // A new item's patch is a "v" (its whole value).
      return change ? applyPatch(item ?? null, change) : item!;
    });
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- diffState made an "o" patch from this object.
  const object = a as {[key: string]: Json};
  const changes = new Map(patch.c);
  // fromEntries defines own properties, so a key like "__proto__" stays plain data.
  return Object.fromEntries(
    (patch.keys ?? Object.keys(object)).map(key => {
      const change = changes.get(key);
      // A new key's patch is a "v" (its whole value).
      return [key, change ? applyPatch(object[key] ?? null, change) : object[key]!];
    })
  );
}
