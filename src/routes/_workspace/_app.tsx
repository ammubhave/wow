import {createFileRoute, Outlet} from "@tanstack/react-router";

import {SiteHeader} from "@/components/site-header";
import {SidebarProvider} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_workspace/_app")({component: RouteComponent});

function RouteComponent() {
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader />
        <div className="flex flex-1 justify-center items-center flex-col gap-4 p-4 md:gap-8 md:p-10 overflow-auto">
          <Outlet />
        </div>
      </SidebarProvider>
    </div>
  );
}
