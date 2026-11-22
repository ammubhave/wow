import {useMutationState, useQuery, useQueryClient} from "@tanstack/react-query";
import {createContext, useContext, useEffect, useRef} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {ReadyState} from "react-use-websocket/dist/lib/constants";

import {ConnectionBanner} from "@/components/connection-banner";
import {WorkspaceSkeleton} from "@/components/page-skeletons";
import {track} from "@/lib/analytics";
import {useWebSocket} from "@/lib/use-websocket";
import {applyOptimistic, workspaceQueryOptions} from "@/lib/workspace-mutations";
import {
  applyWorkspacePatch,
  socketStates,
  countSocketMessage,
  workspaceSocketUrl,
} from "@/lib/workspace-socket";
import {expandWorkspaceState, type WorkspaceRoomState} from "@/lib/workspace-state";
import type {
  WorkspaceFullMessage,
  WorkspacePatchMessage,
  WorkspaceResyncRequest,
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
  // The bare state: what the room sent before patches (a room not yet updated mid-deploy).
  | WorkspaceRoomWireState
  | VoiceServerMessage;

/** How long to wait for the full state after asking before asking again. */
const RESYNC_RETRY_MS = 5000;
/** Asks before giving up and reconnecting (which always starts from the full state). */
const RESYNC_ATTEMPTS = 3;

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
  // While waiting for the full state after a patch didn't fit: the retry timer and attempts so far.
  const resync = useRef<{timer: ReturnType<typeof setTimeout>; attempts: number} | null>(null);
  const stopResync = () => {
    if (resync.current) clearTimeout(resync.current.timer);
    resync.current = null;
  };
  // Asks the room for the full state; patches arriving meanwhile are dropped (they don't fit
  // either). Retries a few times, then reconnects, which always starts with the full state.
  const requestResync = (reason: string) => {
    if (resync.current) return;
    countSocketMessage("resync", 0);
    track("workspace_resync", {reason});
    const attempt = (attempts: number) => {
      if (attempts >= RESYNC_ATTEMPTS) {
        stopResync();
        getWebSocket()?.close();
        return;
      }
      sendJsonMessage({type: "workspaceResync"} satisfies WorkspaceResyncRequest);
      resync.current = {timer: setTimeout(() => attempt(attempts + 1), RESYNC_RETRY_MS), attempts};
    };
    attempt(0);
  };
  useEffect(
    () => () => {
      if (resync.current) clearTimeout(resync.current.timer);
      resync.current = null;
      // The socket closes with this provider; its state no longer tracks the room.
      socketStates.delete(workspaceSlug);
    },
    [workspaceSlug]
  );
  const {readyState, sendJsonMessage, getWebSocket} = useWebSocket(
    workspaceSocketUrl(workspaceSlug),
    {
      share: true,
      shouldReconnect: () => true,
      // Nothing reads `lastMessage`; don't keep every message in React state.
      filter: () => false,
      // A new connection starts with the full state, so any resync in progress is moot.
      onClose: stopResync,
      // The room sends the full state on connect, then patches. Each result goes into the query
      // cache; `setQueryData` structurally shares it with the previous one, so unchanged
      // rounds/puzzles keep their identity.
      onMessage: event => {
        const message: WorkspaceSocketMessage = JSON.parse(event.data);
        if (!("type" in message) || typeof message.type !== "string") {
          // The bare state: no version, so patches can't follow it until a full state arrives.
          socketStates.delete(workspaceSlug);
          queryClient.setQueryData(queryKey, message);
          return;
        }
        if (message.type === "workspace") {
          const {version, state} = message;
          socketStates.set(workspaceSlug, {version, state});
          countSocketMessage("full", String(event.data).length);
          stopResync();
          queryClient.setQueryData(queryKey, state);
          return;
        }
        if (message.type === "workspacePatch") {
          // Waiting for the full state: this patch was made from a state we don't have.
          if (resync.current) return;
          countSocketMessage("patch", String(event.data).length);
          const outcome = applyWorkspacePatch(workspaceSlug, message);
          if (outcome.ok) queryClient.setQueryData(queryKey, outcome.state);
          else requestResync(outcome.reason);
          return;
        }
        {
          const voice = message;
          switch (voice.type) {
            case "voiceHello":
              queryClient.setQueryData(voiceMeQueryKey(workspaceSlug), voice.connectionId);
              return;
            case "voice": {
              queryClient.setQueryData(voiceRoomsQueryKey(workspaceSlug), voice.rooms);
              // Whoever left a call, or muted, has stopped talking.
              const unmuted = new Set(
                Object.values(voice.rooms).flatMap(room =>
                  room.filter(p => !p.muted).map(p => p.connectionId)
                )
              );
              queryClient.setQueryData<string[]>(voiceSpeakingQueryKey(workspaceSlug), speaking =>
                speaking?.filter(id => unmuted.has(id))
              );
              return;
            }
            case "speaking": {
              const {connectionId, speaking} = voice;
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
      },
    }
  );
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
