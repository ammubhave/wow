import {createLocalJWKSet, errors, jwtVerify, type JSONWebKeySet} from "jose";

import {auth} from "@/lib/auth";
import {API_RESOURCE, BEARER_PROTOCOL, EXTENSION_CLIENT_ID} from "@/lib/extension";

export type Session = typeof auth.$Infer.Session;

/**
 * The signed-in session behind a request, however it's signed in:
 *
 * - the website's session cookie (better-auth's own session), or
 * - an OAuth access token from a first-party client (the Chrome extension, src/lib/extension.ts),
 *   as `Authorization: Bearer <token>`, or on a websocket upgrade (which can't carry headers from a
 *   browser) as the subprotocol pair `[BEARER_PROTOCOL, <token>]`.
 *
 * Every API route and procedure resolves its caller through here, so both work everywhere.
 * `fresh` reads a cookie session straight from the database without refreshing it (websocket
 * upgrades: see getRequestSession in workspace-access.ts).
 */
export async function getHeadersSession(
  headers: Headers,
  {fresh = false}: {fresh?: boolean} = {}
): Promise<Session | null> {
  const token = bearerToken(headers);
  if (token !== undefined) return token ? sessionOfAccessToken(token) : null;
  return auth.api.getSession({
    headers,
    query: fresh ? {disableCookieCache: true, disableRefresh: true} : {},
  });
}

/**
 * The access token a request carries: a string (maybe empty, for a malformed one, which signs no
 * one in) when it carries one, undefined when it doesn't (so the cookie decides).
 */
function bearerToken(headers: Headers) {
  const authorization = headers.get("Authorization");
  if (authorization !== null) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
    return match?.[1] ?? "";
  }
  const protocols = offeredProtocols(headers);
  const at = protocols.indexOf(BEARER_PROTOCOL);
  if (at === -1) return undefined;
  return protocols[at + 1] ?? "";
}

/** The websocket subprotocols a request offers (`Sec-WebSocket-Protocol`), in order. */
export const offeredProtocols = (headers: Headers) =>
  (headers.get("Sec-WebSocket-Protocol") ?? "")
    .split(",")
    .map(protocol => protocol.trim())
    .filter(Boolean);

/** Whether a websocket upgrade signs in with an access token (so its 101 must pick BEARER_PROTOCOL). */
export const offersBearerProtocol = (headers: Headers) =>
  offeredProtocols(headers).includes(BEARER_PROTOCOL);

/**
 * The OAuth provider's signing keys (the JWT plugin's JWKS), read in-process: fetching our own
 * `/api/auth/jwks` from the Worker would loop back through it. Kept for a while, and reread when a
 * token names a key we don't have (a key rotated in since).
 */
let keySet: {keys: ReturnType<typeof createLocalJWKSet>; readAt: number} | undefined;
const KEY_SET_MS = 10 * 60 * 1000;

async function signingKeys(reread = false) {
  if (!keySet || reread || Date.now() - keySet.readAt > KEY_SET_MS) {
    const jwks: JSONWebKeySet = await auth.api.getJwks();
    keySet = {keys: createLocalJWKSet(jwks), readAt: Date.now()};
  }
  return keySet.keys;
}

async function verifyAccessToken(token: string) {
  const options = {audience: API_RESOURCE, issuer: await issuer()};
  try {
    return (await jwtVerify(token, await signingKeys(), options)).payload;
  } catch (error) {
    if (!(error instanceof errors.JWKSNoMatchingKey)) throw error;
    return (await jwtVerify(token, await signingKeys(true), options)).payload;
  }
}

/** Who issues the access tokens: the OAuth provider at this app's auth base URL. */
async function issuer() {
  return (await auth.$context).baseURL;
}

/**
 * The session an access token stands for: its user (still there, and read fresh, like a cookie
 * session's), with a stand-in session record (nothing on the server reads its fields). Null for a
 * token that's invalid, expired, for another API, or from a client other than the extension.
 */
async function sessionOfAccessToken(token: string): Promise<Session | null> {
  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return null;
  }
  if (!payload.sub || payload.azp !== EXTENSION_CLIENT_ID) return null;
  const context = await auth.$context;
  const user = await context.internalAdapter.findUserById(payload.sub);
  if (!user) return null;
  const issuedAt = new Date((payload.iat ?? 0) * 1000);
  const session: Session["session"] = {
    id: `oauth:${payload.jti ?? payload.sub}`,
    userId: user.id,
    token: "",
    expiresAt: new Date((payload.exp ?? 0) * 1000),
    createdAt: issuedAt,
    updatedAt: issuedAt,
    ipAddress: null,
    userAgent: null,
  };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the adapter's user is the same row getSession returns (additional fields included).
  return {user: user as Session["user"], session};
}
