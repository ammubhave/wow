/**
 * Workspace IDs (slugs): a workspace's address is `/<slug>`, so a new one can't take a name the
 * app's own pages, API or files use. Checked when creating one (the create form and, for anyone
 * calling the API directly, `beforeCreateOrganization` in auth.ts). It's also the workspace's
 * contact email, `<slug>@wafflehaus.io` (src/server/inbound-email.ts), so the usual role addresses
 * are kept out too.
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
  // Email addresses (<slug>@wafflehaus.io) people expect to reach the site, not a team: the
  // standard role addresses (RFC 2142), mail-system ones, and ones that could pass for WOW's own
  "contact",
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "postmaster",
  "hostmaster",
  "webmaster",
  "mailer-daemon",
  "bounce",
  "bounces",
  "dmarc",
  "unsubscribe",
  "abuse",
  "security",
  "support",
  "hello",
  "info",
  "mail",
  "noc",
  "www",
  "ftp",
  "smtp",
  "imap",
  "billing",
  "privacy",
  "legal",
  "press",
  "news",
  "sales",
  "marketing",
  "feedback",
  "jobs",
  "careers",
  "notifications",
  "alerts",
  "system",
  "root",
  "administrator",
  "moderator",
  "staff",
  "team",
  "official",
  "wow",
  "wafflehaus",
  // Kept for later (pages the site may grow, and common sign-in paths)
  "admin",
  "settings",
  "help",
  "about",
  "pricing",
  "donate",
  "new",
  "account",
  "accounts",
  "auth",
  "oauth",
  "signin",
  "sign-in",
  "sign-up",
  "register",
  "logout",
  "dashboard",
  "home",
  "search",
  "status",
  "blog",
  "static",
  "public",
  "robots",
  "sitemap",
  "manifest",
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
