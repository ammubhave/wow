import {
  PuzzleActivityLogEntrySubType,
  RoundActivityLogEntrySubType,
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
  }: {
    subType: PuzzleActivityLogEntrySubType;
    puzzleId: string;
    puzzleName: string;
    workspaceId: string;
  }) {
    await this.ctx.db.puzzleActivityLogEntry.create({
      select: { id: true },
      data: {
        subType,
        puzzleId,
        userId: this.ctx.user.id,
        workspaceId,
        puzzleName,
      },
    });
  }
}
