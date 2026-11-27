import {useExtensionUser} from "./page-auth";

/**
 * Stands in for the website's better-auth client (src/lib/auth-client.ts) in the extension (see
 * wxt.config.ts): the shared components the extension shows only ask it who's signed in, and here
 * that's the extension's OAuth user, not a session cookie.
 */
export const authClient = {
  useSession() {
    const user = useExtensionUser();
    return {data: user ? {user} : null, isPending: user === undefined, error: null};
  },
};
