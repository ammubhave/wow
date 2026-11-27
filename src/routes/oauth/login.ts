import {createFileRoute} from "@tanstack/react-router";

/**
 * The OAuth provider's login page (`loginPage` in src/lib/auth.ts). Someone authorizing a client
 * (the Chrome extension) who isn't signed in lands here with the authorization request, signed by
 * the provider. This sends them to the ordinary login page, and once they're signed in, back to the
 * authorization endpoint with the original request, which then goes on (to the client, or to the
 * consent page) with their new session. Any way of signing in works: email, passkey or Google.
 */
export const Route = createFileRoute("/oauth/login")({
  server: {
    handlers: {
      GET: ({request}) => {
        const authorize = new URLSearchParams(new URL(request.url).search);
        // The provider's signature over the request (only for its own pages), and a prompt that
        // already happened: asking for login or an account again would come straight back here.
        for (const name of ["sig", "exp", "ba_iat", "ba_pl", "ba_param", "prompt"]) {
          authorize.delete(name);
        }
        const login = new URLSearchParams({
          redirectTo: `/api/auth/oauth2/authorize?${authorize.toString()}`,
        });
        return new Response(null, {status: 302, headers: {Location: `/login?${login.toString()}`}});
      },
    },
  },
});
