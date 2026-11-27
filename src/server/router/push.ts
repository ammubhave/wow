import {and, eq} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {PUSH_KINDS} from "@/server/notifications";

import {procedure} from "./base";

/**
 * The browsers' push services. WOW sends to a subscription's endpoint, so only these are accepted:
 * otherwise anyone could have WOW send requests wherever they liked.
 */
const PUSH_SERVICE_HOSTS = [
  // Chrome and other Chromium browsers: fcm.googleapis.com, or jmt17.google.com for Chromium's
  // own builds.
  /^fcm\.googleapis\.com$/,
  /^[\w-]+\.google\.com$/,
  /^([\w-]+\.)*push\.services\.mozilla\.com$/, // Firefox
  /^([\w-]+\.)*push\.apple\.com$/, // Safari (macOS, and iOS home-screen apps)
  /^([\w-]+\.)*notify\.windows\.com$/, // Edge on Windows
];

const isPushService = (endpoint: string) => {
  const url = URL.parse(endpoint);
  return url?.protocol === "https:" && PUSH_SERVICE_HOSTS.some(host => host.test(url.hostname));
};

const base64Url = z.string().regex(/^[\w-]+$/);

/** Web Push: the devices that get your notifications when WOW isn't open (src/server/push.ts). */
export const pushRouter = {
  /**
   * Turns on (or updates) push for this device, for the kinds of notification it wants. A device
   * someone else signed in on before moves to you.
   */
  subscribe: procedure
    .input(
      z.object({
        endpoint: z.string().max(2048).refine(isPushService, "Not a browser push service."),
        p256dh: base64Url.max(128),
        auth: base64Url.max(64),
        kinds: z.enum(PUSH_KINDS).array().max(PUSH_KINDS.length),
      })
    )
    .handler(async ({context, input}) => {
      const values = {
        userId: context.session.user.id,
        p256dh: input.p256dh,
        auth: input.auth,
        kinds: [...new Set(input.kinds)],
      };
      await db
        .insert(schema.pushSubscription)
        .values({endpoint: input.endpoint, ...values})
        .onConflictDoUpdate({
          target: schema.pushSubscription.endpoint,
          set: {...values, updatedAt: new Date()},
        });
    }),

  /** Turns off push for this device. */
  unsubscribe: procedure
    .input(z.object({endpoint: z.string().max(2048)}))
    .handler(async ({context, input}) => {
      await db
        .delete(schema.pushSubscription)
        .where(
          and(
            eq(schema.pushSubscription.endpoint, input.endpoint),
            eq(schema.pushSubscription.userId, context.session.user.id)
          )
        );
    }),
};
