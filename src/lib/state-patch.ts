/**
 * Patches between two versions of a JSON value (the workspace room state), so a change to one
 * puzzle sends that puzzle instead of the whole board.
 *
 * Guarantees, which the tests check on random states:
 *  - `applyPatch(a, diffState(a, b))` serializes to exactly `JSON.stringify(b)`: same values, same
 *    key order, same array order. So `stateChecksum` of the result equals the server's checksum of
 *    `b`, and a client can verify every patch it applies.
 *  - Anything left unchanged keeps its object identity, so React re-renders only what changed.
 *  - Applying a patch to the wrong base throws (or fails the checksum); it never silently produces
 *    a different state. Clients then ask for the full state again.
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

/** Thrown when a patch doesn't fit the state it's applied to (the client is out of sync). */
export class PatchMismatchError extends Error {
  constructor(message: string) {
    super(`Patch doesn't fit the state: ${message}`);
    this.name = "PatchMismatchError";
  }
}

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

/**
 * `state` with `patch` applied. Doesn't modify `state`; unchanged parts are shared with it. Throws
 * `PatchMismatchError` when the patch was made from a different state.
 */
export function applyPatch(state: Json, patch: Patch): Json {
  switch (patch.t) {
    case "v":
      return patch.v;
    case "a": {
      if (!Array.isArray(state)) throw new PatchMismatchError("expected a list");
      const currentIds = itemIds(state);
      if (!currentIds) throw new PatchMismatchError("expected a list of items with ids");
      const current = new Map(currentIds.map((id, i) => [id, state[i]!]));
      const changes = new Map(patch.u);
      const ids = patch.ids ?? currentIds;
      return ids.map(id => {
        const change = changes.get(id);
        const item = current.get(id);
        if (change) {
          if (item === undefined && change.t !== "v") throw new PatchMismatchError(`no item ${id}`);
          return applyPatch(item ?? null, change);
        }
        if (item === undefined) throw new PatchMismatchError(`no item ${id}`);
        return item;
      });
    }
    case "o": {
      if (!isObject(state)) throw new PatchMismatchError("expected an object");
      const changes = new Map(patch.c);
      const keys = patch.keys ?? Object.keys(state);
      // fromEntries defines own properties, so a key like "__proto__" stays plain data.
      return Object.fromEntries(
        keys.map(key => {
          const change = changes.get(key);
          const has = Object.hasOwn(state, key);
          if (change) {
            if (!has && change.t !== "v") throw new PatchMismatchError(`no key ${key}`);
            return [key, applyPatch(has ? state[key]! : null, change)];
          }
          if (!has) throw new PatchMismatchError(`no key ${key}`);
          return [key, state[key]!];
        })
      );
    }
    default:
      throw new PatchMismatchError("unknown patch");
  }
}

/**
 * A checksum of a serialized state (cyrb53, plus the length), to check a patched state matches the
 * server's exactly. Not cryptographic: it only has to catch bugs and missed messages.
 */
export function stateChecksum(serialized: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < serialized.length; i++) {
    const ch = serialized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${serialized.length.toString(36)}-${hash.toString(36)}`;
}
