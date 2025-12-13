import {createFileRoute, Link, Outlet} from "@tanstack/react-router";

import {Button} from "@/components/ui/button";

export const Route = createFileRoute("/_public")({component: RouteComponent});

function RouteComponent() {
  return (
    <div className="h-screen flex flex-col">
      <header className="bg-background sticky top-0 z-10 flex h-16 items-center gap-4 border-b px-4 md:px-6">
        <nav className="flex flex-row items-center gap-5 text-lg font-medium md:text-sm lg:gap-6">
          <Button variant="ghost" asChild>
            <Link to="/" className="flex items-center gap-2 text-lg font-semibold md:text-base">
              <img src="/favicon.ico" className="shrink-0 size-6 rounded-full" />
            </Link>
          </Button>
          <div className="contents flex-1 text-lg font-semibold">
            <span className="font-semi-bold text-lg">Wafflehaüs Organized Workspace</span>
          </div>
        </nav>
      </header>
      <main className="overflow-y-auto bg-muted/40 flex min-h-[calc(100dvh_-_theme(spacing.16))] flex-1 flex-col gap-4 p-4 md:gap-8 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}
