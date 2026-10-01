import {v7 as uuid7} from "uuid";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import type {Session} from "../base";

// Each entry is a base row plus a subtype row. The id is generated here so both inserts go in one
// atomic D1 batch (one round trip, and no orphaned base row if the second insert fails).
export class ActivityLogService {
  constructor(private readonly session: Session) {}

  async createRound({
    subType,
    roundId,
    roundName,
    workspaceId,
  }: {
    subType: "create" | "delete";
    roundId: string | null;
    workspaceId: string;
    roundName: string;
  }) {
    const id = uuid7();
    await db.batch([
      db.insert(schema.activityLogEntry).values({id, userId: this.session.user.id, workspaceId}),
      db
        .insert(schema.roundActivityLogEntry)
        .values({activityLogEntryId: id, subType, roundId, roundName}),
    ]);
  }

  async createPuzzle({
    subType,
    puzzleId,
    puzzleName,
    workspaceId,
    field,
  }: {
    subType: "create" | "delete" | "updateStatus" | "updateImportance" | "updateAnswer";
    puzzleId: string;
    puzzleName: string;
    workspaceId: string;
    field?: string;
  }) {
    const id = uuid7();
    await db.batch([
      db.insert(schema.activityLogEntry).values({id, userId: this.session.user.id, workspaceId}),
      db
        .insert(schema.puzzleActivityLogEntry)
        .values({activityLogEntryId: id, subType, puzzleId, puzzleName, field}),
    ]);
  }

  async createWorkspace({subType, workspaceId}: {subType: "join"; workspaceId: string}) {
    const id = uuid7();
    await db.batch([
      db.insert(schema.activityLogEntry).values({id, userId: this.session.user.id, workspaceId}),
      db.insert(schema.workspaceActivityLogEntry).values({activityLogEntryId: id, subType}),
    ]);
  }
}
