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

/** A better-auth error, as a message to show beside the form. */
export function authErrorMessage(
  error: {status?: number; message?: string | undefined} | null | undefined,
  fallback: string
) {
  if (error?.status === 429) return "Too many attempts. Wait a minute, then try again.";
  return error?.message || fallback;
}
