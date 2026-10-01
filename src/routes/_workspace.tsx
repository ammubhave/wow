import {createFileRoute, Outlet, redirect} from "@tanstack/react-router";
import {posthog} from "posthog-js";
import {useEffect} from "react";

import {authClient} from "@/lib/auth-client";
import {getSession} from "@/lib/auth-server";
import {authMiddleware} from "@/middlewares/auth";

export const Route = createFileRoute("/_workspace")({
  component: RouteComponent,
  server: {middleware: [authMiddleware]},
  loader: async ({location}) => {
    const session = await getSession();
    if (!session) throw redirect({to: "/login", search: {redirectTo: location.pathname}});
  },
});

function RouteComponent() {
  const user = authClient.useSession().data?.user;
  useEffect(() => {
    if (!user) return;
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
  }, [user]);
  return (
    <div className="flex min-h-dvh flex-col">
      <Outlet />
    </div>
  );
}
