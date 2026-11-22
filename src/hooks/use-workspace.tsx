import {useMutationState, useQuery, useQueryClient} from "@tanstack/react-query";
import {createContext, useContext, useEffect} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {ReadyState} from "react-use-websocket/dist/lib/constants";

import {ConnectionBanner} from "@/components/connection-banner";
import {WorkspaceSkeleton} from "@/components/page-skeletons";
import {applyPatch, type Json} from "@/lib/state-patch";
import {useWebSocket} from "@/lib/use-websocket";
import {applyOptimistic, workspaceQueryOptions} from "@/lib/workspace-mutations";
import {socketStates, workspaceSocketUrl} from "@/lib/workspace-socket";
import {expandWorkspaceState, type WorkspaceRoomState} from "@/lib/workspace-state";
import type {
  WorkspaceFullMessage,
  WorkspacePatchMessage,
  WorkspaceRoomWireState,
} from "@/server/do/workspace";
import type {VoiceServerMessage} from "@/server/voice";

// Voice presence pushed over the workspace socket, kept in the query cache (never fetched).
/** Who's in which voice room. */
export const voiceRoomsQueryKey = (workspaceSlug: string) => ["voiceRooms", workspaceSlug] as const;
/** Connection ids of whoever is talking right now. */
export const voiceSpeakingQueryKey = (workspaceSlug: string) =>
  ["voiceSpeaking", workspaceSlug] as const;
/** This tab's connection id. */
export const voiceMeQueryKey = (workspaceSlug: string) => ["voiceMe", workspaceSlug] as const;

type WorkspaceSocketMessage =
  | WorkspaceFullMessage
  | WorkspacePatchMessage
  // The bare state: what a room still running the previous version sends, briefly, mid-deploy.
  | WorkspaceRoomWireState
  | VoiceServerMessage;

const WorkspaceContext = createContext<WorkspaceRoomState | null>(null);

export function WorkspaceProvider({
  children,
  workspaceSlug,
}: {
  children: React.ReactNode;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = workspaceQueryOptions(workspaceSlug).queryKey;
  useEffect(
    // The socket closes with this provider (VoiceProvider, its other user, is inside it), and a
    // new provider's socket starts with the full state.
    () => () => void socketStates.delete(workspaceSlug),
    [workspaceSlug]
  );
  const {readyState} = useWebSocket(workspaceSocketUrl(workspaceSlug), {
    share: true,
    shouldReconnect: () => true,
    // Nothing reads `lastMessage`; don't keep every message in React state.
    filter: () => false,
    // Every connection starts with the full state, then each patch is what changed since the
    // previous message, in order (see the room, src/server/do/workspace.ts). Each result goes
    // into the query cache; `setQueryData` structurally shares it with the previous one, so
    // unchanged rounds/puzzles keep their identity.
    onMessage: event => {
      const message: WorkspaceSocketMessage = JSON.parse(event.data);
      let state: WorkspaceRoomWireState;
      if (!("type" in message) || typeof message.type !== "string") state = message;
      else if (message.type === "workspace") state = message.state;
      else if (message.type === "workspacePatch") {
        // The previous message on this socket set it.
        const current = socketStates.get(workspaceSlug)!;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- parsed JSON, in the room's shape.
        state = applyPatch(current as unknown as Json, message.patch) as unknown as typeof current;
      } else {
        handleVoice(message);
        return;
      }
      socketStates.set(workspaceSlug, state);
      queryClient.setQueryData(queryKey, state);
    },
  });
  function handleVoice(message: VoiceServerMessage) {
    switch (message.type) {
      case "voiceHello":
        queryClient.setQueryData(voiceMeQueryKey(workspaceSlug), message.connectionId);
        return;
      case "voice": {
        queryClient.setQueryData(voiceRoomsQueryKey(workspaceSlug), message.rooms);
        // Whoever left a call, or muted, has stopped talking.
        const unmuted = new Set(
          Object.values(message.rooms).flatMap(room =>
            room.filter(p => !p.muted).map(p => p.connectionId)
          )
        );
        queryClient.setQueryData<string[]>(voiceSpeakingQueryKey(workspaceSlug), speaking =>
          speaking?.filter(id => unmuted.has(id))
        );
        return;
      }
      case "speaking": {
        const {connectionId, speaking} = message;
        queryClient.setQueryData<string[]>(voiceSpeakingQueryKey(workspaceSlug), current => {
          const others = (current ?? []).filter(id => id !== connectionId);
          return speaking ? [...others, connectionId] : others;
        });
        return;
      }
      default:
        // Handled elsewhere (voiceMute: VoiceProvider).
        return;
    }
  }
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
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
      <ConnectionBanner isOpen={readyState === ReadyState.OPEN} />
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return workspace;
}
