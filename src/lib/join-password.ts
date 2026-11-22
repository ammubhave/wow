/**
 * Join links can carry the workspace password, so one click joins:
 * `https://join.wafflehaus.io/<workspace>#pw=<password>`.
 *
 * It rides in the URL's fragment (after `#`), which browsers never send to a server, so it stays
 * out of server and Cloudflare logs. As the app starts, before analytics (PostHog) records the
 * address and before any sign-in redirect, it's taken out of the address bar and kept in this
 * tab's session storage until the join page fills it in.
 */

const KEY = "wow:join-password:";
const JOIN_PATH = /^\/workspaces\/join\/([^/]+)\/?$/;

/** The link a teammate opens to join with the password filled in. */
export const joinLinkWithPassword = (workspaceSlug: string, password: string) =>
  `https://join.wafflehaus.io/${workspaceSlug}#pw=${encodeURIComponent(password)}`;

/** Runs once, as the app loads (see __root.tsx). */
export function captureJoinPassword() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const password = params.get("pw");
  if (password === null) return;
  const slug = JOIN_PATH.exec(window.location.pathname)?.[1];
  try {
    if (slug) sessionStorage.setItem(KEY + decodeURIComponent(slug), password);
  } catch {
    // No session storage (private mode): they type the password, as before.
  }
  // Out of the address bar, history and anything that reads the URL from here on.
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname + window.location.search
  );
}

/** The password a join link brought for this workspace, if any. */
export function joinPasswordFor(workspaceSlug: string): string | null {
  try {
    return sessionStorage.getItem(KEY + workspaceSlug);
  } catch {
    return null;
  }
}

/** Forgets it (once they've joined). */
export function forgetJoinPassword(workspaceSlug: string) {
  try {
    sessionStorage.removeItem(KEY + workspaceSlug);
  } catch {
    // Nothing kept.
  }
}
