import {createFileRoute, Outlet, redirect} from "@tanstack/react-router";
import {useEffect} from "react";

import {ChildSkeleton} from "@/components/page-skeletons";
import {getSession} from "@/lib/session";

export const Route = createFileRoute("/_workspace")({
  component: RouteComponent,
  // Only waits on the network when the tab doesn't already know you're signed in (a fresh load,
  // or just after signing in), so moving between pages doesn't.
  loader: async ({location}) => {
    const session = await getSession("signed-in");
    if (!session) throw redirect({to: "/login", search: {redirectTo: location.href}});
  },
  // A fresh load waits here first: show the skeleton of the page being opened, in this layout.
  pendingComponent: () => (
    <div className="flex min-h-dvh flex-col">
      <ChildSkeleton from="/_workspace" />
    </div>
  ),
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
