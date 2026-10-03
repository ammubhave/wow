import {env, waitUntil} from "cloudflare:workers";
import {PostHog} from "posthog-node";

let client: PostHog | undefined;

/**
 * Report an unexpected server error to PostHog error tracking (next to the browser's errors). Sent
 * after the response, so it never slows a request down. Off in development.
 */
export function captureServerException(
  error: unknown,
  {distinctId, properties}: {distinctId?: string; properties?: Record<string, unknown>} = {}
) {
  if (import.meta.env.DEV || !env.VITE_PUBLIC_POSTHOG_KEY) return;
  // Workers can't keep a batch queue alive between requests: send each one right away.
  client ??= new PostHog(env.VITE_PUBLIC_POSTHOG_KEY, {
    host: env.VITE_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  waitUntil(send(client, error, distinctId, {source: "worker", ...properties}));
}

async function send(
  posthog: PostHog,
  error: unknown,
  distinctId: string | undefined,
  properties: Record<string, unknown>
) {
  try {
    await posthog.captureExceptionImmediate(error, distinctId, properties);
  } catch (reportError) {
    console.error("PostHog capture failed", reportError);
  }
}
