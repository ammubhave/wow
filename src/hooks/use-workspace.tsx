import {useMutationState, useQuery, useQueryClient} from "@tanstack/react-query";
import {createContext, useContext} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";

import {WorkspaceSkeleton} from "@/components/page-skeletons";
import {applyOptimistic, workspaceQueryOptions} from "@/lib/workspace-mutations";
import {expandWorkspaceState, type WorkspaceRoomState} from "@/lib/workspace-state";
import type {WorkspaceRoomWireState} from "@/server/do/workspace";

const WorkspaceContext = createContext<WorkspaceRoomState | null>(null);

export function WorkspaceProvider({
  children,
  workspaceSlug,
}: {
  children: React.ReactNode;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  useWebSocket(`/api/workspaces/${workspaceSlug}`, {
    share: true,
    shouldReconnect: () => true,
    // Nothing reads `lastMessage`; don't keep every message in React state.
    filter: () => false,
    // Each message is the full workspace state. `setQueryData` structurally shares it with the
    // previous one, so unchanged rounds/puzzles keep their identity.
    onMessage: event => {
      const wire: WorkspaceRoomWireState = JSON.parse(event.data);
      queryClient.setQueryData(workspaceQueryOptions(workspaceSlug).queryKey, wire);
    },
  });
  // Pending optimistic mutations for this workspace, oldest first (see workspace-mutations.ts).
  const pending = useMutationState({
    filters: {
      status: "pending",
      predicate: ({meta, state: {variables}}) =>
        meta?.optimistic !== undefined &&
        typeof variables === "object" &&
        variables !== null &&
        "workspaceSlug" in variables &&
        variables.workspaceSlug === workspaceSlug,
    },
    select: mutation => ({apply: mutation.meta!.optimistic!, variables: mutation.state.variables}),
  });
  // `select` output is structurally shared too, so only rows that actually changed re-render.
  const {data: workspace} = useQuery({
    ...workspaceQueryOptions(workspaceSlug),
    select: wire => expandWorkspaceState(applyOptimistic(wire, pending)),
  });
  // Normally prefetched by the route loader; this covers the rare case it isn't ready yet.
  if (!workspace) return <WorkspaceSkeleton />;
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return workspace;
}
