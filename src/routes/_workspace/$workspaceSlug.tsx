import {ORPCError} from "@orpc/client";
import {createFileRoute, notFound, Outlet} from "@tanstack/react-router";
import {redirect} from "@tanstack/react-router";

import {NotificationsWebSocket} from "@/components/notifications-websocket";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {WorkspaceFooter} from "@/components/workspace-footer";
import {WorkspaceHeader} from "@/components/workspace-header";
import {WorkspaceProvider} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";
import {workspaceQueryOptions} from "@/lib/workspace-mutations";

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
  component: RouteComponent,
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  return (
    // Keyed so switching workspaces starts from a clean slate (spinner) instead of briefly showing,
    // and mutating against, the previous workspace's state until the new socket's first message.
    <WorkspaceProvider key={workspaceSlug} workspaceSlug={workspaceSlug}>
      <NotificationsWebSocket workspaceSlug={workspaceSlug}>
        <PresencesWebSocket workspaceSlug={workspaceSlug}>
          <div className="flex flex-1 flex-col">
            <WorkspaceHeader />
            <div className="relative flex flex-1">
              <div className="absolute inset-0 flex overflow-auto">
                <Outlet />
              </div>
            </div>
            <WorkspaceFooter />
          </div>
        </PresencesWebSocket>
      </NotificationsWebSocket>
    </WorkspaceProvider>
  );
}
