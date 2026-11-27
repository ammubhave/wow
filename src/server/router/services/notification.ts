import {env} from "cloudflare:workers";
import {and, eq, ne, sql} from "drizzle-orm";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type {FavoriteNotification, NewNotification} from "@/server/notifications";

export class NotificationService {
  /** Pushes a notification to the workspace's members (and keeps it for the bell). */
  async broadcast(workspaceId: string, data: NewNotification) {
    await env.NOTIFICATION_ROOMS.getByName(workspaceId, {locationHint: "enam"}).broadcast(
      workspaceId,
      data
    );
  }

  /**
   * Tells whoever starred a puzzle what just happened on it (not the person who did it). Does
   * nothing when nobody else starred it.
   */
  async favorite(
    workspaceId: string,
    data: Omit<FavoriteNotification, "id" | "timestamp" | "type" | "toUserIds">
  ) {
    const starred = await db
      .select({userId: schema.member.userId})
      .from(schema.member)
      .where(
        and(
          eq(schema.member.organizationId, workspaceId),
          ne(schema.member.userId, data.by.id),
          sql`exists (select 1 from json_each(${schema.member.favoritePuzzleIds}) where value = ${data.puzzleId})`
        )
      );
    if (starred.length === 0) return;
    await this.broadcast(workspaceId, {
      type: "favorite",
      toUserIds: starred.map(row => row.userId),
      ...data,
    });
  }
}
