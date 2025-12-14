import {createFileRoute, Outlet, redirect} from "@tanstack/react-router";
import posthog from "posthog-js";
import {useEffect} from "react";

import {authClient} from "@/lib/auth-client";
import {getSession} from "@/lib/auth-server";
import {authMiddleware} from "@/middlewares/auth";

export const Route = createFileRoute("/_workspace")({
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
  return <Outlet />;
}
