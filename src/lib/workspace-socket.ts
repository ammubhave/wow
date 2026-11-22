import type {WorkspaceRoomWireState} from "@/server/do/workspace";

import {applyPatch, type Json, type Patch, stateChecksum} from "./state-patch";

/**
 * The workspace socket's URL. Every hook on it must use exactly this, so they share one socket.
 * `patches` asks the room for changes rather than the whole board on every edit.
 */
export const workspaceSocketUrl = (workspaceSlug: string) =>
  `/api/workspaces/${workspaceSlug}?patches`;

/**
 * The state each workspace socket last delivered, by workspace slug, and its version: the base the
 * next patch must apply to. The socket is the only writer. The workspace query reads it too (see
 * `workspaceQueryOptions`), so a refetch can never replace it with an older copy.
 */
export const socketStates = new Map<string, {version: string; state: WorkspaceRoomWireState}>();

export type PatchOutcome =
  | {ok: true; state: WorkspaceRoomWireState}
  | {ok: false; reason: "no-base" | "wrong-base" | "mismatch" | "checksum"};

/**
 * Applies a patch to this workspace's state, if it was made from that state and the result matches
 * the server's checksum exactly. On success the new state is recorded as the current one; on
 * failure nothing changes and the caller asks for the full state.
 */
export function applyWorkspacePatch(
  workspaceSlug: string,
  message: {base: string; version: string; checksum: string; patch: Patch}
): PatchOutcome {
  const current = socketStates.get(workspaceSlug);
  if (!current) return {ok: false, reason: "no-base"};
  if (current.version !== message.base) return {ok: false, reason: "wrong-base"};
  let next: Json;
  try {
    // The wire state is plain JSON (it arrived through JSON.parse).
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- parsed JSON, typed by the server.
    next = applyPatch(current.state as unknown as Json, message.patch);
  } catch {
    return {ok: false, reason: "mismatch"};
  }
  if (stateChecksum(JSON.stringify(next)) !== message.checksum) {
    return {ok: false, reason: "checksum"};
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- checksum-identical to the server's state.
  const state = next as unknown as WorkspaceRoomWireState;
  socketStates.set(workspaceSlug, {version: message.version, state});
  return {ok: true, state};
}

/** Counts of what the workspace socket received, for checking sync by hand in development. */
const socketStats = {full: 0, patch: 0, patchBytes: 0, fullBytes: 0, resync: 0};

export function countSocketMessage(kind: "full" | "patch" | "resync", bytes: number) {
  socketStats[kind]++;
  if (kind === "full") socketStats.fullBytes += bytes;
  if (kind === "patch") socketStats.patchBytes += bytes;
}

if (import.meta.env.DEV && typeof window !== "undefined") {
  Object.assign(window, {__wowWorkspaceSocket: {states: socketStates, stats: socketStats}});
}
