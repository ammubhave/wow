import {createFileRoute, Outlet} from "@tanstack/react-router";

import {SiteHeader} from "@/components/site-header";

export const Route = createFileRoute("/_workspace/_app")({component: RouteComponent});

function RouteComponent() {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <div className="flex flex-col">
        <SiteHeader />
        {/* Pages bring their own frame (Page); this is at least the screen's height below the
            header, so a full-screen page (joining a workspace) can center itself in it. */}
        <div className="flex min-h-[calc(100svh-var(--header-height))] flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
