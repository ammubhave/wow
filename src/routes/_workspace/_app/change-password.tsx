import {createFileRoute, redirect} from "@tanstack/react-router";

// Changing the password now lives on the Account page; keep old links working.
export const Route = createFileRoute("/_workspace/_app/change-password")({
  beforeLoad: () => {
    throw redirect({to: "/profile"});
  },
});
