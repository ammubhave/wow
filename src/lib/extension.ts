/**
 * The WOW Chrome extension (extension/): a first-party OAuth client of this app. It signs in through
 * the OAuth provider (`/api/auth/oauth2/*`, see src/lib/auth.ts) and calls the same oRPC API and
 * websocket rooms as the website, with the access token instead of the session cookie.
 */

/**
 * The extension's ID. It's fixed by the public key in its manifest (extension/wxt.config.ts), so
 * it's the same unpacked in development and in the Chrome Web Store.
 */
export const EXTENSION_ID = "cjlnmohemgdbijeapkgofjndnhphmebd";

/** Its OAuth client, registered by a migration (public: no secret, PKCE). */
export const EXTENSION_CLIENT_ID = "wow-chrome-extension";

/** Where Chrome hands the extension its authorization code (`chrome.identity.launchWebAuthFlow`). */
export const EXTENSION_REDIRECT_URI = `https://${EXTENSION_ID}.chromiumapp.org/`;

/**
 * The resource (RFC 8707) the extension's access tokens are for: this app's API. Tokens for it are
 * JWTs with this audience, which the API checks before taking one in place of a session.
 */
export const API_RESOURCE = "https://www.wafflehaus.io/api";

/** What the extension asks for: who you are, and a refresh token to stay signed in. */
export const EXTENSION_SCOPES = ["openid", "profile", "email", "offline_access"];

/**
 * The websocket subprotocol that carries an access token. Browsers can't set headers on a
 * websocket, so the extension offers `[BEARER_PROTOCOL, token]` and the server answers with
 * BEARER_PROTOCOL (never echoing the token).
 */
export const BEARER_PROTOCOL = "wow.bearer";
