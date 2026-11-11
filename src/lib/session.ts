import {authClient} from "./auth-client";

/**
 * The signed-in session, or null, for route guards (`beforeLoad`/`loader` redirects). The app is
 * a pure SPA, so this runs in the browser and asks the auth API (`/api/auth/get-session`).
 */
export async function getSession() {
  const {data} = await authClient.getSession();
  return data;
}
