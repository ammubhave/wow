import {ORPCError} from "@orpc/client";
import {createFileRoute, Outlet} from "@tanstack/react-router";
import {redirect} from "@tanstack/react-router";

import {NotificationsWebSocket} from "@/components/notifications-websocket";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {SidebarProvider} from "@/components/ui/sidebar";
import {WorkspaceHeader} from "@/components/workspace-header";
import {authClient} from "@/lib/auth-client";
import {client} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/$workspaceId")({
  beforeLoad: async ({params}) => {
    try {
      await client.workspaces.get({workspaceId: params.workspaceId});
    } catch (e) {
      if (e instanceof ORPCError && e.code === "FORBIDDEN") {
        throw redirect({
          to: "/workspaces/join/$workspaceId",
          params: {workspaceId: params.workspaceId},
        });
      }
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const {workspaceId} = Route.useParams();
  const {data: session} = authClient.useSession();

  if (!session) return null;
  return (
    <NotificationsWebSocket workspaceId={workspaceId}>
      <PresencesWebSocket workspaceId={workspaceId}>
        <div className="[--header-height:calc(--spacing(14))]">
          <SidebarProvider className="flex flex-col">
            <WorkspaceHeader />
            <div className="flex flex-1 relative">
              <div className="absolute inset-0 flex overflow-auto">
                <Outlet />
              </div>
            </div>
          </SidebarProvider>
        </div>
      </PresencesWebSocket>
    </NotificationsWebSocket>
  );
}
