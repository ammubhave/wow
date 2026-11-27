import {createFileRoute, Outlet} from "@tanstack/react-router";

import {HomeSkeleton} from "@/components/page-skeletons";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home")({
  component: RouteComponent,
  pendingComponent: HomeSkeleton,
});

function RouteComponent() {
  return (
    <div className="flex flex-1">
      <div
        className="flex flex-1 flex-col overflow-auto"
        data-scroll-restoration-id="workspace-home">
        <Outlet />
      </div>
    </div>
  );
}
