import {createFileRoute, Outlet} from "@tanstack/react-router";

import {NotificationsWebSocket} from "@/components/notifications-websocket";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {SidebarProvider} from "@/components/ui/sidebar";
import {WorkspaceHeader} from "@/components/workspace-header";
import {authClient} from "@/lib/auth-client";

export const Route = createFileRoute("/_workspace/$workspaceId")({component: RouteComponent});

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
            <div className="flex flex-1">
              <Outlet />
            </div>
          </SidebarProvider>
        </div>
      </PresencesWebSocket>
    </NotificationsWebSocket>
  );
}
