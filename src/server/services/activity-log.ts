import {
  PuzzleActivityLogEntrySubType,
  RoundActivityLogEntrySubType,
  WorkspaceActivityLogEntrySubType,
} from "@prisma/client";

import { Context } from "../trpc";

export class ActivityLogService {
  constructor(private readonly ctx: Context) {
    this.ctx = ctx;
  }

  async createRound({
    subType,
    roundId,
    roundName,
    workspaceId,
  }: {
    subType: RoundActivityLogEntrySubType;
    roundId: string | null;
    workspaceId: string;
    roundName: string;
  }) {
    await this.ctx.db.roundActivityLogEntry.create({
      select: { id: true },
      data: {
        subType,
        roundId,
        userId: this.ctx.user.id,
        workspaceId,
        roundName,
      },
    });
  }

  async createPuzzle({
    subType,
    puzzleId,
    puzzleName,
    workspaceId,
    field,
  }: {
    subType: PuzzleActivityLogEntrySubType;
    puzzleId: string;
    puzzleName: string;
    workspaceId: string;
    field?: string;
  }) {
    await this.ctx.db.puzzleActivityLogEntry.create({
      select: { id: true },
      data: {
        subType,
        puzzleId,
        userId: this.ctx.user.id,
        workspaceId,
        puzzleName,
        field,
      },
    });
  }

  async createWorkspace({
    subType,
    workspaceId,
  }: {
    subType: WorkspaceActivityLogEntrySubType;
    workspaceId: string;
  }) {
    await this.ctx.db.workspaceActivityLogEntry.create({
      data: {
        userId: this.ctx.user.id,
        workspaceId: workspaceId,
        subType,
      },
    });
  }
}
