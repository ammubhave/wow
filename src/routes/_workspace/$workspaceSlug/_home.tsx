import {createFileRoute, Outlet} from "@tanstack/react-router";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-1">
      <div className="flex flex-1 flex-col overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
