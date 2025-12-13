import {createFileRoute, Outlet, useChildMatches} from "@tanstack/react-router";

import {AppSidebar} from "@/components/app-sidebar";
import {SidebarInset} from "@/components/ui/sidebar";
import {Tabs} from "@/components/ui/tabs";

export const Route = createFileRoute("/_workspace/$workspaceId/_home")({component: RouteComponent});

function RouteComponent() {
  const {workspaceId} = Route.useParams();
  const childMatches = useChildMatches();
  const navigate = Route.useNavigate();
  return (
    <>
      <SidebarInset>
        <Tabs
          value={childMatches[0]?.fullPath}
          onValueChange={to => {
            void navigate({to});
          }}
          className="flex-1 flex flex-col">
          <Outlet />
        </Tabs>
      </SidebarInset>
      <AppSidebar side="right" workspaceId={workspaceId} />
    </>
  );
}
