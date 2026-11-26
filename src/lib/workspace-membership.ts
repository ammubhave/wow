import type {QueryClient} from "@tanstack/react-query";

import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";
import {workspaceQueryOptions} from "@/lib/workspace-mutations";
import {socketStates} from "@/lib/workspace-socket";

/**
 * After joining, leaving or accepting an invitation to a workspace: the workspace switcher and
 * that workspace's cached board catch up.
 *
 * - The switcher reads Better Auth's list of workspaces, which only refreshes itself after Better
 *   Auth's own calls; these go through WOW's API.
 * - The workspace page loads with `ensureQueryData`, which serves whatever is cached even when
 *   stale, so a board kept from before (a workspace you left, then rejoined) is dropped instead.
 *
 * Call it after leaving the workspace's pages: dropping the board while it's showing would reload
 * it, without access.
 */
export function workspaceMembershipChanged(queryClient: QueryClient, workspaceSlug: string) {
  authClient.$store.notify("$listOrg");
  socketStates.delete(workspaceSlug);
  queryClient.removeQueries({queryKey: workspaceQueryOptions(workspaceSlug).queryKey});
  queryClient.removeQueries({
    queryKey: orpc.workspaces.members.get.queryKey({input: {workspaceSlug}}),
  });
}
