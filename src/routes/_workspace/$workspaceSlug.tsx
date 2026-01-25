import {createFileRoute, notFound, Outlet} from "@tanstack/react-router";
import {redirect} from "@tanstack/react-router";
import {createServerFn} from "@tanstack/react-start";
import {getRequestHeaders} from "@tanstack/react-start/server";
import {APIError} from "better-auth";
import {z} from "zod";

import {NotificationsWebSocket} from "@/components/notifications-websocket";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {SidebarProvider} from "@/components/ui/sidebar";
import {WorkspaceHeader} from "@/components/workspace-header";
import {WorkspaceProvider} from "@/hooks/use-workspace";
import {auth} from "@/lib/auth";
import {authClient} from "@/lib/auth-client";

export const isMember = createServerFn()
  .inputValidator(z.object({workspaceSlug: z.string()}))
  .handler(async ({data: {workspaceSlug}}) => {
    try {
      await auth.api.getFullOrganization({
        headers: getRequestHeaders(),
        query: {organizationSlug: workspaceSlug},
      });
      return true;
    } catch (e) {
      if (e instanceof APIError) {
        if (e.status === "FORBIDDEN") {
          return false;
        } else if (e.body?.code === "ORGANIZATION_NOT_FOUND") {
          throw notFound();
        }
      }
      throw e;
    }
  });

export const Route = createFileRoute("/_workspace/$workspaceSlug")({
  beforeLoad: async ({params}) => {
    if (!isMember({data: {workspaceSlug: params.workspaceSlug}})) {
      throw redirect({
        to: "/workspaces/join/$workspaceSlug",
        params: {workspaceSlug: params.workspaceSlug},
      });
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
