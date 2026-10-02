import {useSuspenseQuery} from "@tanstack/react-query";
import {useParams} from "@tanstack/react-router";

import {orpc} from "@/lib/orpc";

/**
 * Whether you own the current workspace (see `WorkspaceRole`). Owners manage its name, password,
 * integrations and members' roles; the server enforces this, the UI just reflects it.
 */
export function useIsWorkspaceOwner() {
  const {workspaceSlug} = useParams({from: "/_workspace/$workspaceSlug"});
  // Loaded with the workspace (its route loader), so this doesn't suspend in practice.
  const member = useSuspenseQuery(
    orpc.workspaces.members.get.queryOptions({input: {workspaceSlug}})
  ).data;
  return member.role === "owner";
}
