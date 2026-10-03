import {ORPCError} from "@orpc/client";
import {createFileRoute, notFound, Outlet} from "@tanstack/react-router";
import {redirect} from "@tanstack/react-router";
import {posthog} from "posthog-js";
import {useEffect} from "react";

import {WorkspaceSkeleton} from "@/components/page-skeletons";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {WorkspaceFooter} from "@/components/workspace-footer";
import {WorkspaceHeader} from "@/components/workspace-header";
import {AwaySummary, NotificationsWebSocket} from "@/features/notifications/notifications";
import {VoiceProvider} from "@/features/voice/voice-provider";
import {CallBar} from "@/features/voice/voice-ui";
import {useWorkspace, WorkspaceProvider} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";
import {workspaceQueryOptions} from "@/lib/workspace-mutations";
import {applyAccent} from "@/lib/workspace-theme";

export const Route = createFileRoute("/_workspace/$workspaceSlug")({
  // Loads the room state into the query cache before the board renders (in parallel with the
  // favorites). Cached afterwards, so navigating within the workspace doesn't hit the server; the
  // websocket keeps it current. The procedure also enforces membership.
  loader: async ({context: {queryClient}, params: {workspaceSlug}}) => {
    try {
      await Promise.all([
        queryClient.ensureQueryData(workspaceQueryOptions(workspaceSlug)),
        // The board's favorites (it suspends on them); fetched in parallel rather than after.
        queryClient.ensureQueryData(
          orpc.workspaces.members.get.queryOptions({input: {workspaceSlug}})
        ),
      ]);
    } catch (error) {
      if (error instanceof ORPCError && error.code === "FORBIDDEN") {
        throw redirect({to: "/workspaces/join/$workspaceSlug", params: {workspaceSlug}});
      }
      if (error instanceof ORPCError && error.code === "NOT_FOUND") throw notFound();
      throw error;
    }
  },
  pendingComponent: WorkspaceSkeleton,
  component: RouteComponent,
});

/**
 * Puts everything you do here (in PostHog) in this workspace's group, so analytics can count teams,
 * not just people.
 */
function WorkspaceAnalyticsGroup() {
  const {id, name, slug, teamName, eventName} = useWorkspace();
  useEffect(() => {
    posthog.group("workspace", id, {name, slug, teamName, eventName});
    return () => posthog.resetGroups();
  }, [id, name, slug, teamName, eventName]);
  return null;
}

/** Tints the page with the workspace's accent color while you're in it. */
function WorkspaceAccent() {
  const {accent} = useWorkspace().theme;
  useEffect(() => applyAccent(accent), [accent]);
  return null;
}

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  return (
    // Keyed so switching workspaces starts from a clean slate (spinner) instead of briefly showing,
    // and mutating against, the previous workspace's state until the new socket's first message.
    <WorkspaceProvider key={workspaceSlug} workspaceSlug={workspaceSlug}>
      <NotificationsWebSocket workspaceSlug={workspaceSlug}>
        <PresencesWebSocket workspaceSlug={workspaceSlug}>
          <VoiceProvider workspaceSlug={workspaceSlug}>
            <div className="flex flex-1 flex-col">
              <WorkspaceHeader />
              <div className="relative flex flex-1">
                <div className="absolute inset-0 flex overflow-auto">
                  <Outlet />
                </div>
              </div>
              <WorkspaceFooter />
            </div>
            <CallBar />
            <AwaySummary workspaceSlug={workspaceSlug} />
            <WorkspaceAccent />
            <WorkspaceAnalyticsGroup />
          </VoiceProvider>
        </PresencesWebSocket>
      </NotificationsWebSocket>
    </WorkspaceProvider>
  );
}
