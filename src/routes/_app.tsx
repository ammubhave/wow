import {createFileRoute, Outlet, redirect} from "@tanstack/react-router";
import posthog from "posthog-js";
import {useEffect} from "react";

import {SiteHeader} from "@/components/site-header";
import {SidebarProvider} from "@/components/ui/sidebar";
import {authClient} from "@/lib/auth-client";
import {getSession} from "@/lib/auth-server";
import {authMiddleware} from "@/middlewares/auth";

export const Route = createFileRoute("/_app")({
  component: RouteComponent,
  server: {middleware: [authMiddleware]},
  loader: async () => {
    const session = await getSession();
    if (!session) throw redirect({to: "/login"});
  },
});

function RouteComponent() {
  const session = authClient.useSession().data;
  useEffect(() => {
    if (!session) return;
    posthog.identify(
      session.user.id,
      {
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        name: session.user.name,
        updatedAt: session.user.updatedAt,
      },
      {createdAt: session.user.createdAt}
    );
  }, [session?.user]);
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
