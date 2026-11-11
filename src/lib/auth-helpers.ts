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
  return error?.message || fallback;
}
