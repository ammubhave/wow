import {authClient} from "./auth-client";

/**
 * The session as this tab already knows it (better-auth's session store, which every page keeps
 * loaded and which signing in or out refreshes), or `undefined` while that isn't settled: still
 * loading, being refreshed (as it is right after signing in or out), or failed.
 */
function settledSession() {
  const session = authClient.$store.atoms.session?.get();
  return !session || session.isPending || session.isRefetching || session.error
    ? undefined
    : session.data;
}

/**
 * The signed-in session, or null, for route guards (`beforeLoad`/`loader` redirects). The app is
 * a pure SPA, so this runs in the browser and asks the auth API (`/api/auth/get-session`).
 *
 * `trust` skips that round trip when the tab already knows the answer the guard hopes for, so
 * navigating doesn't wait on the network: "signed-in" for pages that need a session (if it has
 * since ended, the API refuses everything anyway and the next guard check catches it),
 * "signed-out" for the sign-in pages. Anything else is asked of the server.
 */
export async function getSession(trust?: "signed-in" | "signed-out") {
  const known = settledSession();
  if (
    known !== undefined &&
    (trust === "signed-in" ? known !== null : trust === "signed-out" ? known === null : false)
  ) {
    return known;
  }
  const {data} = await authClient.getSession();
  return data;
}
