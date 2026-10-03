import {useMutationState, useQuery, useQueryClient} from "@tanstack/react-query";
import {createContext, useContext} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {ReadyState} from "react-use-websocket/dist/lib/constants";
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";

import {ConnectionBanner} from "@/components/connection-banner";
import {WorkspaceSkeleton} from "@/components/page-skeletons";
import {applyOptimistic, workspaceQueryOptions} from "@/lib/workspace-mutations";
import {expandWorkspaceState, type WorkspaceRoomState} from "@/lib/workspace-state";
import type {WorkspaceRoomWireState} from "@/server/do/workspace";
import type {VoiceServerMessage} from "@/server/voice";

// Voice presence pushed over the workspace socket, kept in the query cache (never fetched).
/** Who's in which voice room. */
export const voiceRoomsQueryKey = (workspaceSlug: string) => ["voiceRooms", workspaceSlug] as const;
/** Connection ids of whoever is talking right now. */
export const voiceSpeakingQueryKey = (workspaceSlug: string) =>
  ["voiceSpeaking", workspaceSlug] as const;
/** This tab's connection id. */
export const voiceMeQueryKey = (workspaceSlug: string) => ["voiceMe", workspaceSlug] as const;

// The workspace state itself has no `type`; every other message on the socket is about voice.
const isVoiceMessage = (
  message: WorkspaceRoomWireState | VoiceServerMessage
): message is VoiceServerMessage => "type" in message && typeof message.type === "string";

const WorkspaceContext = createContext<WorkspaceRoomState | null>(null);

export function WorkspaceProvider({
  children,
  workspaceSlug,
}: {
  children: React.ReactNode;
  workspaceSlug: string;
}) {
  const queryClient = useQueryClient();
  const {readyState} = useWebSocket(`/api/workspaces/${workspaceSlug}`, {
    share: true,
    shouldReconnect: () => true,
    // Nothing reads `lastMessage`; don't keep every message in React state.
    filter: () => false,
    // Each message is the full workspace state. `setQueryData` structurally shares it with the
    // previous one, so unchanged rounds/puzzles keep their identity.
    onMessage: event => {
      const message: WorkspaceRoomWireState | VoiceServerMessage = JSON.parse(event.data);
      if (isVoiceMessage(message)) {
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
      queryClient.setQueryData(workspaceQueryOptions(workspaceSlug).queryKey, message);
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
