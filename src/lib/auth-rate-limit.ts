import type {BetterAuthRateLimitOptions} from "better-auth";
import {env} from "cloudflare:workers";

/**
 * Better Auth's rate limits (per client IP and path), counted by Cloudflare's rate-limiting
 * bindings instead of Better Auth's default in-memory store, which each Worker isolate kept on its
 * own. A binding has a fixed limit and period, so each rule here has a binding of its own in
 * wrangler.jsonc with the same numbers (`ratelimits`; keep the two in step).
 *
 * Counts are per Cloudflare location, so the limits are approximate: right for slowing guessing,
 * which Turnstile also covers on sign-in and sign-up.
 */
type Rule = {window: number; max: number};

/** Everything else under /api/auth (Better Auth's default). Binding AUTH_RATE_LIMIT. */
const GENERAL: Rule = {window: 10, max: 100};
/**
 * Signing in or up, changing password or email. Better Auth's default is 3 per 10 seconds, but a
 * team in one room shares one IP and signs in together when a hunt starts. Binding
 * AUTH_SIGN_IN_RATE_LIMIT.
 */
const SIGN_IN: Rule = {window: 10, max: 10};
/** Requests that send an email (password reset, verification). Binding AUTH_EMAIL_RATE_LIMIT. */
const EMAIL: Rule = {window: 60, max: 5};

const bindingFor = ({window, max}: Rule) => {
  if (window === SIGN_IN.window && max === SIGN_IN.max) return env.AUTH_SIGN_IN_RATE_LIMIT;
  if (window === EMAIL.window && max === EMAIL.max) return env.AUTH_EMAIL_RATE_LIMIT;
  if (window !== GENERAL.window || max !== GENERAL.max) {
    // A rule with no binding of its own (a plugin's, or a new Better Auth default) gets the general
    // limit rather than none.
    console.warn(`Auth rate limit: no binding for ${max} per ${window}s, using the general one`);
  }
  return env.AUTH_RATE_LIMIT;
};

export const authRateLimit = {
  enabled: true,
  window: GENERAL.window,
  max: GENERAL.max,
  customRules: {
    "/sign-in/*": SIGN_IN,
    "/sign-up/*": SIGN_IN,
    "/change-password": SIGN_IN,
    "/change-email": SIGN_IN,
    "/request-password-reset": EMAIL,
    "/forget-password/*": EMAIL,
    "/send-verification-email": EMAIL,
    // Read-only and called on every page load; a big team behind one IP would hit any limit here.
    "/get-session": false,
  },
  customStorage: {
    consume: async (key, rule) => {
      const {success} = await bindingFor(rule).limit({key});
      return success
        ? {allowed: true, retryAfter: null}
        : {allowed: false, retryAfter: rule.window};
    },
  },
} satisfies BetterAuthRateLimitOptions;
