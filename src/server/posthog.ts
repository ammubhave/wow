import {env, waitUntil} from "cloudflare:workers";
import {PostHog} from "posthog-node";

let client: PostHog | undefined;

/** PostHog, or nothing in development (and without a key). */
function posthog() {
  if (import.meta.env.DEV || !env.VITE_PUBLIC_POSTHOG_KEY) return undefined;
  // Workers can't keep a batch queue alive between requests: send each one right away.
  client ??= new PostHog(env.VITE_PUBLIC_POSTHOG_KEY, {
    host: env.VITE_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

/** Sent after the response, so reporting never slows a request down (or fails it). */
function send(promise: () => Promise<void>) {
  waitUntil(
    (async () => {
      try {
        await promise();
      } catch (error) {
        console.error("PostHog send failed", error);
      }
    })()
  );
}

/**
 * Report an unexpected server error to PostHog error tracking (next to the browser's errors).
 */
export function captureServerException(
  error: unknown,
  {distinctId, properties}: {distinctId?: string; properties?: Record<string, unknown>} = {}
) {
  const ph = posthog();
  if (!ph) return;
  send(() => ph.captureExceptionImmediate(error, distinctId, {source: "worker", ...properties}));
}

/**
 * A product event, by the person who did it (the same id the browser identifies them by), and in
 * their workspace's group, so it counts toward that team.
 */
export function trackServerEvent(
  event: string,
  {
    distinctId,
    workspaceId,
    properties,
  }: {distinctId: string; workspaceId?: string; properties?: Record<string, unknown>}
) {
  const ph = posthog();
  if (!ph) return;
  send(() =>
    ph.captureImmediate({
      distinctId,
      event,
      properties: {source: "server", ...properties},
      groups: workspaceId ? {workspace: workspaceId} : undefined,
    })
  );
}
