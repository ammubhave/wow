import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {invariant} from "@/lib/invariant";

import {AuthenticatedContext} from "../base";

export class ActivityLogService {
  constructor(private readonly ctx: AuthenticatedContext) {}

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
    const [result] = await db
      .insert(schema.activityLogEntry)
      .values({userId: this.ctx.session.user.id, workspaceId})
      .returning({id: schema.activityLogEntry.id});
    invariant(result);
    await db
      .insert(schema.roundActivityLogEntry)
      .values({activityLogEntryId: result.id, subType, roundId, roundName});
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
    const [result] = await db
      .insert(schema.activityLogEntry)
      .values({userId: this.ctx.session.user.id, workspaceId})
      .returning({id: schema.activityLogEntry.id});
    invariant(result);
    await db
      .insert(schema.puzzleActivityLogEntry)
      .values({activityLogEntryId: result.id, subType, puzzleId, puzzleName, field});
  }

  async createWorkspace({subType, workspaceId}: {subType: "join"; workspaceId: string}) {
    const [result] = await db
      .insert(schema.activityLogEntry)
      .values({userId: this.ctx.session.user.id, workspaceId})
      .returning({id: schema.activityLogEntry.id});
    invariant(result);
    await db
      .insert(schema.workspaceActivityLogEntry)
      .values({activityLogEntryId: result.id, subType});
  }
}
