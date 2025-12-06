import {createFileRoute, Outlet, redirect} from "@tanstack/react-router";
import posthog from "posthog-js";
import {useEffect} from "react";

import {authClient} from "@/lib/auth-client";
import {authMiddleware} from "@/middlewares/auth";

export const Route = createFileRoute("/_workspace")({
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
  return <Outlet />;
}
