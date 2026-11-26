/**
 * Workspace IDs (slugs): a workspace's address is `/<slug>`, so a new one can't take a name the
 * app's own pages, API or files use. Checked when creating one (the create form and, for anyone
 * calling the API directly, `beforeCreateOrganization` in auth.ts).
 */

/** Top-level paths of the app, its API and static files, and a few kept for later. */
const RESERVED = new Set([
  // Pages (src/routes)
  "docs",
  "exchange",
  "login",
  "signup",
  "forgot-password",
  "forgot-password-check-email",
  "reset-password",
  "privacy-policy",
  "tos",
  "change-password",
  "hunts",
  "profile",
  "stats",
  "workspaces",
  // The Worker and Cloudflare
  "api",
  "assets",
  "cdn-cgi",
  // Kept for later
  "admin",
  "settings",
  "help",
  "about",
  "pricing",
  "donate",
  "new",
]);

/** Letters, digits, "-" and "_", starting with a letter or digit (existing IDs use capitals). */
const SHAPE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
export const MAX_SLUG_LENGTH = 40;

/** Why `slug` can't be a new workspace's ID, or null if it can. */
export function workspaceSlugProblem(slug: string): string | null {
  if (!slug) return "Choose a workspace ID.";
  if (slug.length > MAX_SLUG_LENGTH)
    return `Keep the ID to ${MAX_SLUG_LENGTH} characters or fewer.`;
  if (!SHAPE.test(slug)) return "Use only letters, numbers, dashes and underscores.";
  if (RESERVED.has(slug.toLowerCase())) return `"${slug}" is reserved. Choose another ID.`;
  return null;
}
