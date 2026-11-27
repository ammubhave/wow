import {z} from "zod";

import {API_RESOURCE, EXTENSION_CLIENT_ID, EXTENSION_SCOPES} from "@/lib/extension";

import type {ExtensionUser} from "./messages";

/**
 * Signing in to WOW, in the background (service worker), which alone holds the tokens.
 *
 * OAuth 2.1 authorization code with PKCE against WOW's OAuth provider (src/lib/auth.ts): Chrome
 * opens WOW's authorize page in a window (`identity.launchWebAuthFlow`), where you sign in as on the
 * website if you aren't already, and hands back the code at the extension's chromiumapp.org
 * redirect. The access token (an hour) is for WOW's API (API_RESOURCE); the refresh token (30 days,
 * renewed on each use) keeps you signed in.
 */

const ORIGIN = import.meta.env.WOW_ORIGIN;
const AUTH = "auth";
/** Refresh this long before the access token expires, so a request never carries a stale one. */
const REFRESH_EARLY_MS = 2 * 60 * 1000;

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  image: z.string().nullable(),
}) satisfies z.ZodType<ExtensionUser>;

const storedSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** When the access token expires (ms). */
  expiresAt: z.number(),
  user: userSchema,
});
type Stored = z.infer<typeof storedSchema>;

async function load(): Promise<Stored | null> {
  const parsed = storedSchema.safeParse((await browser.storage.local.get(AUTH))[AUTH]);
  return parsed.success ? parsed.data : null;
}

async function save(stored: Stored | null) {
  if (stored) await browser.storage.local.set({[AUTH]: stored});
  else await browser.storage.local.remove(AUTH);
  await syncImageAuth(stored?.accessToken);
}

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const randomString = () => base64Url(crypto.getRandomValues(new Uint8Array(32)));

const userInfoSchema = z.object({
  sub: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  picture: z.string().optional(),
});

/** Who the access token is for: WOW's OpenID Connect userinfo (name, email and picture). */
async function fetchUser(accessToken: string): Promise<ExtensionUser> {
  const response = await fetch(`${ORIGIN}/api/auth/oauth2/userinfo`, {
    headers: {Authorization: `Bearer ${accessToken}`},
  });
  if (!response.ok) throw new Error("Couldn't find out who you are. Please try again.");
  const info = userInfoSchema.parse(await response.json());
  return {
    id: info.sub,
    name: info.name ?? "",
    email: info.email ?? null,
    image: info.picture ?? null,
  };
}

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number(),
});
const tokenErrorSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
});

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(`${ORIGIN}/api/auth/oauth2/token`, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({client_id: EXTENSION_CLIENT_ID, resource: API_RESOURCE, ...params}),
  });
  const body: unknown = await response.json().catch(() => ({}));
  const tokens = tokenSchema.safeParse(body);
  if (response.ok && tokens.success) return tokens.data;
  const error = tokenErrorSchema.catch({}).parse(body);
  throw new TokenError(error.error ?? `http_${response.status}`, error.error_description);
}

class TokenError extends Error {
  constructor(
    readonly code: string,
    description?: string
  ) {
    super(description ?? code);
  }
}

/** Opens WOW to sign in (and allow the extension), and keeps the tokens. */
export async function signIn(): Promise<ExtensionUser> {
  const verifier = randomString();
  const challenge = base64Url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))
  );
  const state = randomString();
  const redirectUri = browser.identity.getRedirectURL();
  const authorize = new URL(`${ORIGIN}/api/auth/oauth2/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: EXTENSION_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: EXTENSION_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: API_RESOURCE,
  }).toString();
  const redirected = await browser.identity.launchWebAuthFlow({
    url: authorize.toString(),
    interactive: true,
  });
  if (!redirected) throw new Error("Signing in was cancelled.");
  const result = new URL(redirected).searchParams;
  if (result.get("state") !== state) throw new Error("Signing in failed. Please try again.");
  const code = result.get("code");
  if (!code) throw new Error(result.get("error_description") ?? "Signing in was cancelled.");
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  if (!tokens.refresh_token) throw new Error("WOW didn't keep you signed in. Please try again.");
  const user = await fetchUser(tokens.access_token);
  await save({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    user,
  });
  return user;
}

let refreshing: Promise<Stored | null> | undefined;

/** Renews the access token (once at a time); signs out if the refresh token no longer works. */
function refresh(stored: Stored) {
  refreshing ??= (async () => {
    try {
      const tokens = await tokenRequest({
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
      });
      const next: Stored = {
        accessToken: tokens.access_token,
        // Rotated on every use: the old one stops working.
        refreshToken: tokens.refresh_token ?? stored.refreshToken,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        user: stored.user,
      };
      // Saved straight away: the old refresh token is spent, and Chrome may stop the service
      // worker at any moment.
      await save(next);
      // Your name or picture may have changed since; if WOW doesn't say, keep the last.
      const user = await fetchUser(tokens.access_token).catch(() => null);
      if (!user || JSON.stringify(user) === JSON.stringify(stored.user)) return next;
      const updated = {...next, user};
      await save(updated);
      return updated;
    } catch (error) {
      // Revoked, expired or reused: you're signed out. (A network failure keeps you signed in.)
      if (error instanceof TokenError && error.code === "invalid_grant") {
        await save(null);
        return null;
      }
      throw error;
    } finally {
      refreshing = undefined;
    }
  })();
  return refreshing;
}

/** A current access token and who it's for, or null when signed out. */
export async function getAccessToken() {
  let stored = await load();
  if (!stored) return null;
  if (stored.expiresAt - Date.now() < REFRESH_EARLY_MS) stored = await refresh(stored);
  if (!stored) return null;
  return {token: stored.accessToken, expiresAt: stored.expiresAt, user: stored.user};
}

/** Forgets the tokens, and revokes the refresh token at WOW. */
export async function signOut() {
  const stored = await load();
  await save(null);
  if (!stored) return;
  await fetch(`${ORIGIN}/api/auth/oauth2/revoke`, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({
      client_id: EXTENSION_CLIENT_ID,
      token: stored.refreshToken,
      token_type_hint: "refresh_token",
    }),
  }).catch(() => undefined);
}

/**
 * Chat images and team emoji are `<img>`s of WOW's API, which can't carry the access token
 * themselves: a session rule adds it to image and media requests the extension's own pages make to
 * WOW's API (nobody else's requests). Kept in step with the token, and set again at startup.
 */
const IMAGE_AUTH_RULE = 1;

export async function syncImageAuth(token?: string) {
  token ??= (await load())?.accessToken;
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [IMAGE_AUTH_RULE],
    addRules: token
      ? [
          {
            id: IMAGE_AUTH_RULE,
            priority: 1,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                {header: "Authorization", operation: "set", value: `Bearer ${token}`},
              ],
            },
            condition: {
              urlFilter: `|${ORIGIN}/api/`,
              initiatorDomains: [import.meta.env.EXTENSION_ID],
              resourceTypes: ["image", "media"],
            },
          },
        ]
      : [],
  });
}
