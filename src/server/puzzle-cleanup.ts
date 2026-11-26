import {WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep} from "cloudflare:workers";
import {env} from "cloudflare:workers";
import {and, eq, isNull, lt, sql} from "drizzle-orm";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {GoogleService} from "@/server/router/services/google";

/**
 * Removing a deleted puzzle's stored data: its chat, whiteboard and built-in sheet (each a Durable
 * Object, with its images in R2) and its Google file. The puzzle's own rows go with it in D1 (they
 * cascade); this is everything that lives elsewhere.
 *
 * Every path that deletes puzzles records them in `deleted_puzzle` in the same batch as the delete
 * (`recordDeletedPuzzle`, `recordDeletedRoundPuzzles`), then starts one workflow per puzzle. Each
 * step is retried on its own and is safe to repeat, and the hourly cron restarts any cleanup that
 * hasn't finished (`retryPendingPuzzleCleanups`), so a failed start or a bad hour doesn't leave
 * data behind.
 */
export type PuzzleCleanupParams = {puzzleId: string};

const ROOM_OPTIONS = {locationHint: "enam"} as const;

export class PuzzleCleanupWorkflow extends WorkflowEntrypoint<Env, PuzzleCleanupParams> {
  async run(event: WorkflowEvent<PuzzleCleanupParams>, step: WorkflowStep) {
    const {puzzleId} = event.payload;
    const record = await step.do("look up the deleted puzzle", async () => {
      const row = await db
        .select({
          workspaceId: schema.deletedPuzzle.workspaceId,
          googleFileId: schema.deletedPuzzle.googleFileId,
          cleanedAt: schema.deletedPuzzle.cleanedAt,
        })
        .from(schema.deletedPuzzle)
        .where(eq(schema.deletedPuzzle.id, puzzleId))
        .get();
      // Plain values only: step results are stored between steps.
      return row
        ? {workspaceId: row.workspaceId, googleFileId: row.googleFileId, done: !!row.cleanedAt}
        : null;
    });
    // Not recorded (never deleted through the app) or already cleaned up by an earlier run.
    if (!record || record.done) return;

    // Each room closes its connections, deletes its images from R2, then its own storage.
    await step.do("clear the chat", () =>
      env.CHAT_ROOMS.getByName(puzzleId, ROOM_OPTIONS).clear(puzzleId)
    );
    await step.do("clear the whiteboard", () =>
      env.WHITEBOARD_ROOMS.getByName(puzzleId, ROOM_OPTIONS).clear(puzzleId)
    );
    await step.do("clear the sheet", () =>
      env.SHEET_ROOMS.getByName(puzzleId, ROOM_OPTIONS).clear(puzzleId)
    );
    const {googleFileId} = record;
    if (googleFileId) {
      await step.do(
        "delete the Google file",
        {retries: {limit: 5, delay: "1 minute", backoff: "exponential"}, timeout: "1 minute"},
        () => deleteGoogleFile(record.workspaceId, googleFileId)
      );
    }
    await step.do("mark it cleaned up", async () => {
      await db
        .update(schema.deletedPuzzle)
        .set({cleanedAt: new Date()})
        .where(eq(schema.deletedPuzzle.id, puzzleId));
    });
  }
}

/**
 * Moves the puzzle's Google file to the bin. Throws (so the step retries) only when Google might
 * succeed later; a file that's gone, or a Drive that's disconnected or no longer allows it, is
 * left as it is.
 */
async function deleteGoogleFile(workspaceId: string, fileId: string) {
  const token = await new GoogleService().getAccessToken(workspaceId).catch((error: unknown) => {
    console.error(`Puzzle cleanup: no Google token for ${workspaceId}`, error);
    return null;
  });
  if (!token) return;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: {Authorization: `Bearer ${token}`},
  });
  if (response.ok || response.status === 404) return;
  if (response.status === 429 || response.status >= 500) {
    throw new Error(`Google Drive answered ${response.status} deleting ${fileId}`);
  }
  console.error(`Puzzle cleanup: couldn't delete Google file ${fileId}: ${response.status}`);
}

/** The puzzle's Google file: its spreadsheet or drawing (an empty id counts as none). */
const googleFileIdSql = sql<
  string | null
>`coalesce(nullif(${schema.puzzle.googleSpreadsheetId}, ''), nullif(${schema.puzzle.googleDrawingId}, ''))`;

/** Records one puzzle for cleanup. Put it in the same `db.batch` as the puzzle's delete. */
export const recordDeletedPuzzle = (puzzle: {
  id: string;
  workspaceId: string;
  googleSpreadsheetId: string | null;
  googleDrawingId: string | null;
}) =>
  db
    .insert(schema.deletedPuzzle)
    .values({
      id: puzzle.id,
      workspaceId: puzzle.workspaceId,
      googleFileId: puzzle.googleSpreadsheetId || puzzle.googleDrawingId || null,
    });

/**
 * Records every puzzle in a round for cleanup, returning their ids. Put it in the same `db.batch`
 * as the round's delete: read in that batch, so a puzzle added a moment before isn't missed.
 */
export const recordDeletedRoundPuzzles = (round: {id: string; workspaceId: string}) =>
  db
    .insert(schema.deletedPuzzle)
    .select(
      db
        .select({
          id: schema.puzzle.id,
          workspaceId: sql<string>`${round.workspaceId}`.as("workspaceId"),
          googleFileId: googleFileIdSql.as("googleFileId"),
          deletedAt: sql<number>`cast(unixepoch('subsecond') * 1000 as integer)`.as("deletedAt"),
          cleanedAt: sql<null>`null`.as("cleanedAt"),
        })
        .from(schema.puzzle)
        .where(eq(schema.puzzle.roundId, round.id))
    )
    .returning({id: schema.deletedPuzzle.id});

/** Whether `id` belonged to a deleted puzzle (a new puzzle must not take it over). */
export async function isDeletedPuzzleId(id: string) {
  const row = await db
    .select({id: schema.deletedPuzzle.id})
    .from(schema.deletedPuzzle)
    .where(eq(schema.deletedPuzzle.id, id))
    .get();
  return row !== undefined;
}

/** createBatch takes at most 100 instances per call. */
const BATCH_SIZE = 100;

/**
 * Starts a cleanup for each recorded puzzle. Failing to start one is logged, not thrown: the
 * puzzles are already deleted, and the hourly cron starts any cleanup left pending.
 */
export async function startPuzzleCleanup(puzzleIds: string[]) {
  for (let i = 0; i < puzzleIds.length; i += BATCH_SIZE) {
    const batch = puzzleIds.slice(i, i + BATCH_SIZE);
    try {
      // oxlint-disable-next-line no-await-in-loop
      await env.PUZZLE_CLEANUP_WORKFLOW.createBatch(
        batch.map(puzzleId => ({params: {puzzleId} satisfies PuzzleCleanupParams}))
      );
    } catch (error) {
      console.error(`Puzzle cleanup: couldn't start ${batch.length} cleanups`, error);
    }
  }
}

/** A cleanup normally finishes in seconds; one still pending after this is restarted. */
const RETRY_AFTER_MS = 60 * 60 * 1000;

/** Hourly (src/index.ts): restarts cleanups that didn't start or didn't finish. */
export async function retryPendingPuzzleCleanups() {
  const pending = await db
    .select({id: schema.deletedPuzzle.id})
    .from(schema.deletedPuzzle)
    .where(
      and(
        isNull(schema.deletedPuzzle.cleanedAt),
        lt(schema.deletedPuzzle.deletedAt, new Date(Date.now() - RETRY_AFTER_MS))
      )
    )
    .limit(1000);
  if (pending.length > 0) {
    console.log(`Puzzle cleanup: restarting ${pending.length} pending cleanups`);
    await startPuzzleCleanup(pending.map(row => row.id));
  }
}
