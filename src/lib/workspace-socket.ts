import type {WorkspaceRoomWireState} from "@/server/do/workspace";

import {apiSocketUrl} from "./api-endpoint";

/**
 * The workspace socket's URL. Every hook on it must use exactly this, so they share one socket.
 * `diffs` asks the room for changes rather than the whole board on every edit.
 */
export const workspaceSocketUrl = (workspaceSlug: string) =>
  apiSocketUrl(`/api/workspaces/${workspaceSlug}?diffs`);

/**
 * The state the workspace socket last delivered, by workspace slug: what the next patch applies
 * to. The socket is the only writer (see WorkspaceProvider). The workspace query reads it too (see
 * `workspaceQueryOptions`), so a refetch over HTTP, which isn't ordered with the socket, can't
 * replace it with an older copy.
 */
export const socketStates = new Map<string, WorkspaceRoomWireState>();
