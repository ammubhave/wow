import {createFileRoute, Outlet, useNavigate} from "@tanstack/react-router";
import {useEffect} from "react";

import {NotificationsWebSocket} from "@/components/notifications-websocket";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {SidebarProvider} from "@/components/ui/sidebar";
import {WorkspaceHeader} from "@/components/workspace-header";
import {authClient} from "@/lib/auth-client";
import {client} from "@/lib/orpc";

export const Route = createFileRoute("/_workspace/$workspaceId")({component: RouteComponent});

function RouteComponent() {
  const {workspaceId} = Route.useParams();
  const {data: session} = authClient.useSession();
  const navigate = useNavigate();
  useEffect(() => {
    void client.workspaces.get({workspaceId}).catch(() => {
      void navigate({to: "/workspaces/join/$workspaceId", params: {workspaceId}});
    });
  });
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
