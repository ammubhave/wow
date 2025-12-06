import {createFileRoute, Outlet, useChildMatches} from "@tanstack/react-router";

import {AppSidebar} from "@/components/app-sidebar";
import {PresencesCard} from "@/components/presences-card";
import {SidebarInset} from "@/components/ui/sidebar";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";

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
            navigate({to});
          }}
          className="flex-1 flex flex-col">
          <div className="px-4 pt-2 justify-between flex">
            <TabsList>
              <TabsTrigger value="/$workspaceId/">Blackboard</TabsTrigger>
              <TabsTrigger value="/$workspaceId/activity-log">Activity Log</TabsTrigger>
              <TabsTrigger value="/$workspaceId/settings">Settings</TabsTrigger>
            </TabsList>
            <PresencesCard id={workspaceId} />
          </div>
          <Outlet />
        </Tabs>
      </SidebarInset>
      <AppSidebar side="right" workspaceId={workspaceId} />
    </>
  );
}
