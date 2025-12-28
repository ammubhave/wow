import {createFileRoute, Outlet, useChildMatches} from "@tanstack/react-router";

import {AppSidebar} from "@/components/app-sidebar";
import {Tabs} from "@/components/ui/tabs";

export const Route = createFileRoute("/_workspace/$workspaceId/_home")({component: RouteComponent});

function RouteComponent() {
  const {workspaceId} = Route.useParams();
  const childMatches = useChildMatches();
  const navigate = Route.useNavigate();
  return (
    <div className="flex flex-1">
      <Tabs
        value={childMatches[0]?.fullPath}
        onValueChange={to => {
          void navigate({to});
        }}
        className="flex-1 flex flex-col overflow-auto">
        <Outlet />
      </Tabs>
      <AppSidebar side="right" workspaceId={workspaceId} />
    </div>
  );
}
