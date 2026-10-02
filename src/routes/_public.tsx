import {createFileRoute, Outlet} from "@tanstack/react-router";

import {PublicFooter, PublicNavbar} from "@/components/public-chrome";

export const Route = createFileRoute("/_public")({component: RouteComponent});

function RouteComponent() {
  return (
    <div className="flex h-screen flex-col">
      <PublicNavbar />
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* shrink-0: in this flex column a long page would otherwise be squeezed to the viewport
            and spill out under the footer. */}
        <main className="flex min-h-[calc(100dvh-(--spacing(16)))] shrink-0 flex-col gap-4 p-4 md:gap-8 md:p-10">
          <Outlet />
        </main>
        <PublicFooter />
      </div>
    </div>
  );
}
