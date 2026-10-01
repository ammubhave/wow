import {createFileRoute, Outlet} from "@tanstack/react-router";

import {SiteHeader} from "@/components/site-header";

export const Route = createFileRoute("/_workspace/_app")({component: RouteComponent});

function RouteComponent() {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <div className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-auto p-4 md:gap-8 md:p-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
