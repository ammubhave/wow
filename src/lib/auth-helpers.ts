import {z} from "zod";

/**
 * `?redirectTo=` on the auth pages: where to go once signed in. Only same-origin paths are kept, so a
 * crafted link can't bounce someone to another site.
 */
export const redirectToSearch = z.object({
  redirectTo: z
    .string()
    .optional()
    .transform(value =>
      value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
        ? value
        : "/workspaces"
    ),
});

/**
 * Whether `redirectTo` is a server path rather than a page: the OAuth authorization endpoint, which
 * /oauth/login sends people back to after signing in. The router can't go there, the browser must.
 */
export const leavesApp = (redirectTo: string) => redirectTo.startsWith("/api/");

/** Passes `redirectTo` on to another auth page's link, leaving the default out of the URL. */
export function keepRedirect(redirectTo: string) {
  return redirectTo === "/workspaces" ? {} : {redirectTo};
}

/**
 * The login page's search: `redirectTo`, plus the `?error=` code better-auth appends when a Google
 * sign-in fails after the consent screen.
 */
export const loginSearch = redirectToSearch.extend({error: z.string().optional()});

/** A Google sign-in failure (better-auth's `?error=` code), as a message for the login page. */
export function socialSignInErrorMessage(code: string) {
  if (code === "account_not_linked") {
    return (
      "There's already a WOW account with this email. Log in with your email and password " +
      "(use “Forgot password?” if you don't know it), then connect Google from your profile."
    );
  }
  return "Couldn't sign in with Google. Please try again.";
}

/** A better-auth error, as a message to show beside the form. */
export function authErrorMessage(
  error: {status?: number; message?: string | undefined} | null | undefined,
  fallback: string
) {
  if (error?.status === 429) return "Too many attempts. Wait a minute, then try again.";
  // The API's own input checks ("[body.email] Invalid email address; …") aren't for people.
  if (error?.message?.includes("[body.")) return "Check the fields above, then try again.";
  if (error?.message === "Password too short") return "Use a password of at least 8 characters.";
  return error?.message || fallback;
}
