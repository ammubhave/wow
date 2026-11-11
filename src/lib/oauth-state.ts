/**
 * Binds an OAuth "connect" flow (Google Drive, Discord) to the browser that started it, so a link
 * carrying someone else's authorization code can't attach their account to your workspace: the
 * flow's `state` includes a random nonce, which the browser also keeps in a short-lived cookie. The
 * callback accepts the code only when the two match.
 */
export const OAUTH_STATE_COOKIE = "wow_oauth_state";

/** In the browser, as the connect form submits: a fresh nonce, remembered in the cookie. */
export function startOAuthFlow() {
  const nonce = crypto.randomUUID();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  // SameSite=Lax: sent on the provider's top-level redirect back to /api/oauth/*.
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/api/oauth; Max-Age=600; SameSite=Lax${secure}`;
  return nonce;
}

/** On the server, in the callback: whether the state's nonce is the one this browser started. */
export function isOAuthStateFromThisBrowser(request: Request, nonce: string | undefined) {
  if (!nonce) return false;
  const cookie = (request.headers.get("cookie") ?? "")
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${OAUTH_STATE_COOKIE}=`));
  return cookie?.slice(OAUTH_STATE_COOKIE.length + 1) === nonce;
}
