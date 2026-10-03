import {env} from "cloudflare:workers";

import type {NewNotification} from "@/server/notifications";

export class NotificationService {
  /** Pushes a notification to the workspace's members (and keeps it for the bell). */
  async broadcast(workspaceId: string, data: NewNotification) {
    await env.NOTIFICATION_ROOMS.getByName(workspaceId, {locationHint: "enam"}).broadcast(data);
  }
}
