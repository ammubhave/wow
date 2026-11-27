import {BEARER_PROTOCOL} from "./extension";

/**
 * Where the API is and how requests sign in. The website talks to its own origin with its session
 * cookie (the default: relative URLs, nothing added). The Chrome extension's pages live on another
 * origin, so it points this at WOW and signs in with its OAuth access token (src/lib/extension.ts),
 * before rendering any of the shared components that call the API.
 */
type ApiEndpoint = {
  /** WOW's origin, e.g. "https://www.wafflehaus.io"; "" for the page's own. */
  origin: string;
  /** The current access token, if requests sign in with one rather than the cookie. */
  accessToken?: () => string | undefined;
};

let endpoint: ApiEndpoint = {origin: ""};

export function setApiEndpoint(next: ApiEndpoint) {
  endpoint = next;
  apiTokenChanged();
}

/** An API path (`/api/…`) as a URL for fetch, images and links. */
export const apiUrl = (path: string) => endpoint.origin + path;

/** An API path as a websocket URL (a relative one is resolved against the page, ws or wss). */
export const apiSocketUrl = (path: string) =>
  endpoint.origin ? endpoint.origin.replace(/^http/, "ws") + path : path;

/** Headers that sign a request in (none with the cookie). */
export function apiAuthHeaders(): Record<string, string> {
  const token = endpoint.accessToken?.();
  return token ? {Authorization: `Bearer ${token}`} : {};
}

/**
 * apiAuthHeaders as one Headers object that stays current, for clients that take their headers
 * once and read them on every request (the voice engine's PartyTracks): call apiTokenChanged
 * whenever the token changes.
 */
const liveHeaders = new Headers();
export const liveApiAuthHeaders = () => liveHeaders;

export function apiTokenChanged() {
  const token = endpoint.accessToken?.();
  if (token) liveHeaders.set("Authorization", `Bearer ${token}`);
  else liveHeaders.delete("Authorization");
}

/**
 * Subprotocols that sign a websocket in, since a browser can't set its headers (none with the
 * cookie). The server answers with BEARER_PROTOCOL (see src/server/websocket-route.ts).
 */
export function apiSocketProtocols(): string[] | undefined {
  const token = endpoint.accessToken?.();
  return token ? [BEARER_PROTOCOL, token] : undefined;
}
