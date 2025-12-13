import {createFileRoute, Link, Outlet, useChildMatches} from "@tanstack/react-router";

import {cn} from "@/lib/utils";

export const Route = createFileRoute("/_workspace/$workspaceId/_home/settings")({
  component: RouteComponent,
});

function RouteComponent() {
  const childMatches = useChildMatches();
  const match = childMatches[0]!;
  return (
    <div className="flex justify-center px-8">
      <div className="flex max-w-4xl flex-1 flex-col gap-4 md:gap-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Workspace Settings</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-start gap-6 md:grid-cols-[180px_1fr] lg:grid-cols-[250px_1fr]">
          <nav className="text-muted-foreground grid gap-4 text-sm" x-chunk="dashboard-04-chunk-0">
            <Link
              from={Route.fullPath}
              to="."
              className={cn(
                match.routeId === "/_workspace/$workspaceId/_home/settings/" &&
                  "text-primary font-semibold"
              )}>
              General
            </Link>
            <Link
              from={Route.fullPath}
              to="./members"
              className={cn(
                match.routeId === "/_workspace/$workspaceId/_home/settings/members" &&
                  "text-primary font-semibold"
              )}>
              Members
            </Link>
            <Link
              from={Route.fullPath}
              to="./administration"
              className={cn(
                match.routeId === "/_workspace/$workspaceId/_home/settings/administration" &&
                  "text-primary font-semibold"
              )}>
              Administration
            </Link>
          </nav>
          <div className="flex flex-col gap-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
