import {ORPCError} from "@orpc/client";
import {createFileRoute, Outlet} from "@tanstack/react-router";
import {redirect} from "@tanstack/react-router";

import {NotificationsWebSocket} from "@/components/notifications-websocket";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {SidebarProvider} from "@/components/ui/sidebar";
import {WorkspaceHeader} from "@/components/workspace-header";
import {WorkspaceProvider} from "@/hooks/use-workspace";
import {authClient} from "@/lib/auth-client";
import {client} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/$workspaceSlug")({
  beforeLoad: async ({params}) => {
    try {
      await client.workspaces.get({workspaceSlug: params.workspaceSlug});
    } catch (e) {
      if (e instanceof ORPCError && e.code === "FORBIDDEN") {
        throw redirect({
          to: "/workspaces/join/$workspaceSlug",
          params: {workspaceSlug: params.workspaceSlug},
        });
      }
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const {data: session} = authClient.useSession();

  if (!session) return null;
  return (
    <WorkspaceProvider workspaceSlug={workspaceSlug}>
      <NotificationsWebSocket workspaceSlug={workspaceSlug}>
        <PresencesWebSocket workspaceSlug={workspaceSlug}>
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
    </WorkspaceProvider>
  );
}
