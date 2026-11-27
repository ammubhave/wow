import {env} from "cloudflare:workers";
import {and, eq, inArray} from "drizzle-orm";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {describe, notificationUrl} from "@/lib/notification-text";
import type {PushPayload, WorkspaceNotification} from "@/server/notifications";

import {sendWebPush} from "./web-push";

/** Who to contact about our pushes, if a push service needs to (RFC 8292 `sub`). */
const SUBJECT = "https://www.wafflehaus.io";
/** A notification is stale after this long, so a phone that was off for longer doesn't get it. */
const TTL_SECONDS = 12 * 60 * 60;
/** Push services take about 4 KB; the body is cut well short of that. */
const MAX_BODY = 1000;
/** Pushes in flight at once (a big team's solve goes to everyone). */
const BATCH = 25;

/**
 * Sends a workspace notification as Web Push to the devices of everyone it's for (the people it
 * names, or every member) that chose that kind, except whoever did it. Devices whose subscription
 * has gone (uninstalled, permission withdrawn) are forgotten. Does nothing without a VAPID key
 * (local development).
 */
export async function pushNotification(workspaceId: string, notification: WorkspaceNotification) {
  const privateKey = env.VAPID_PRIVATE_KEY;
  const publicKey = env.VITE_PUBLIC_VAPID_KEY;
  if (!privateKey || !publicKey) return;

  // Whoever did it already knows.
  const actor =
    notification.type === "solved" || notification.type === "favorite"
      ? notification.by?.id
      : notification.type === "mention"
        ? notification.from.id
        : undefined;
  const only = "toUserIds" in notification ? notification.toUserIds : null;
  if (only?.length === 0) return;

  const [workspace, subscriptions] = await Promise.all([
    db
      .select({slug: schema.organization.slug})
      .from(schema.organization)
      .where(eq(schema.organization.id, workspaceId))
      .get(),
    db
      .select({
        id: schema.pushSubscription.id,
        userId: schema.pushSubscription.userId,
        endpoint: schema.pushSubscription.endpoint,
        p256dh: schema.pushSubscription.p256dh,
        auth: schema.pushSubscription.auth,
        kinds: schema.pushSubscription.kinds,
      })
      .from(schema.pushSubscription)
      .innerJoin(
        schema.member,
        and(
          eq(schema.member.userId, schema.pushSubscription.userId),
          eq(schema.member.organizationId, workspaceId)
        )
      )
      .where(only ? inArray(schema.pushSubscription.userId, only) : undefined),
  ]);
  if (!workspace) return;
  const targets = subscriptions.filter(
    s =>
      s.userId !== actor &&
      (notification.type === "driveShareFailed" || s.kinds.includes(notification.type))
  );
  if (targets.length === 0) return;

  const {title, body} = describe(notification);
  const payload = JSON.stringify({
    id: notification.id,
    title,
    body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 1)}…` : body,
    url: notificationUrl(workspace.slug, notification),
    workspace: workspace.slug,
  } satisfies PushPayload);
  const options = {
    ttl: TTL_SECONDS,
    subject: SUBJECT,
    // A mention is someone waiting on you: phones may hold back the rest to save battery.
    urgency: notification.type === "mention" ? ("high" as const) : ("normal" as const),
  };

  const gone: string[] = [];
  for (let i = 0; i < targets.length; i += BATCH) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one batch at a time, on purpose (BATCH).
    await Promise.all(
      targets.slice(i, i + BATCH).map(async target => {
        const result = await sendWebPush(target, payload, {publicKey, privateKey}, options).catch(
          (error: unknown) => {
            console.error("Web Push failed", error);
            return "failed" as const;
          }
        );
        if (result === "gone") gone.push(target.id);
      })
    );
  }
  if (gone.length > 0) {
    await db.delete(schema.pushSubscription).where(inArray(schema.pushSubscription.id, gone));
  }
}
