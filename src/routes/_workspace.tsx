import {createFileRoute, Outlet, redirect} from "@tanstack/react-router";
import {useEffect} from "react";

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
  // Hides PostHog's floating support button (see styles.css), which covered the chat's Send button
  // and the footer. Support & feedback in the account menu opens the same chat.
  useEffect(() => {
    document.documentElement.dataset.app = "";
    return () => {
      delete document.documentElement.dataset.app;
    };
  }, []);
  return (
    <div className="flex min-h-dvh flex-col">
      <Outlet />
    </div>
  );
}
