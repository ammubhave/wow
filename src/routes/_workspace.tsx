import {createFileRoute, Outlet, redirect} from "@tanstack/react-router";

import {getSession} from "@/lib/session";

export const Route = createFileRoute("/_workspace")({
  component: RouteComponent,
  loader: async ({location}) => {
    const session = await getSession();
    if (!session) throw redirect({to: "/login", search: {redirectTo: location.pathname}});
  },
});

// PostHog learns who is signed in from PostHogIdentity, on every page (src/routes/__root.tsx).
function RouteComponent() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Outlet />
    </div>
  );
}
