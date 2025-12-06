import {createFileRoute, Outlet, redirect} from "@tanstack/react-router";
import posthog from "posthog-js";
import {useEffect} from "react";

import {SiteHeader} from "@/components/site-header";
import {SidebarProvider} from "@/components/ui/sidebar";
import {authClient} from "@/lib/auth-client";
import {authMiddleware} from "@/middlewares/auth";

export const Route = createFileRoute("/_app")({
  component: RouteComponent,
  server: {middleware: [authMiddleware]},
  loader: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({to: "/login"});
    }
    return {user: session.data.user};
  },
});

function RouteComponent() {
  const {user} = Route.useLoaderData();
  useEffect(() => {
    posthog.identify(
      user.id,
      {
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        updatedAt: user.updatedAt,
      },
      {createdAt: user.createdAt}
    );
  }, [posthog]);
  return (
    <div className="[--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex flex-col">
        <SiteHeader user={user} />
        <div className="flex flex-1 justify-center items-center flex-col gap-4 p-4 md:gap-8 md:p-10 overflow-auto">
          <Outlet />
        </div>
      </SidebarProvider>
    </div>
  );
}
