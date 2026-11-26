import {env, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep} from "cloudflare:workers";
import {and, eq, isNull} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {invalidateWorkspace} from "@/server/do/workspace";
import {DRIVE_DISCONNECTED_DETAIL} from "@/server/drive-share";
import {GoogleService} from "@/server/router/services/google";

/**
 * Makes a new puzzle's Google Sheet (or Drawing) in the team's Drive folder. The puzzle is saved
 * and shown first, with `googleFileJob` saying the file is being made; its page shows that and
 * switches to the file when the room broadcasts its id. Google's passing failures are retried;
 * one that won't go away marks the job failed, and the page offers to try again.
 */
export type PuzzleSheetParams = {puzzleId: string};

type Kind = schema.GoogleFileJob["kind"];
type Made = {fileId: string} | {failed: string} | {skip: true};

const RETRIES = {
  retries: {limit: 5, delay: "15 seconds", backoff: "exponential"},
  timeout: "1 minute",
} as const;

export class PuzzleSheetWorkflow extends WorkflowEntrypoint<Env, PuzzleSheetParams> {
  async run(event: WorkflowEvent<PuzzleSheetParams>, step: WorkflowStep) {
    const {puzzleId} = event.payload;
    let made: Made;
    try {
      made = await step.do("make the file", RETRIES, () => makeFile(puzzleId));
    } catch (error) {
      // Google kept failing through every retry.
      const reason = error instanceof Error ? error.message : String(error);
      made = {failed: `Google Drive kept failing: ${reason}`};
    }
    await step.do("save it", () => save(puzzleId, made));
  }
}

/** The puzzle, its workspace's Drive setup, and the job, as they are now. */
async function load(puzzleId: string) {
  return await db
    .select({
      name: schema.puzzle.name,
      job: schema.puzzle.googleFileJob,
      workspaceId: schema.organization.id,
      folderId: schema.organization.googleFolderId,
      templateFileId: schema.organization.googleTemplateFileId,
      sheetsTool: schema.organization.sheetsTool,
    })
    .from(schema.puzzle)
    .innerJoin(schema.round, eq(schema.round.id, schema.puzzle.roundId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.round.workspaceId))
    .where(eq(schema.puzzle.id, puzzleId))
    .get();
}

const fileSchema = z.object({id: z.string()});
const listSchema = z.object({files: z.array(fileSchema).optional()});

/**
 * Makes the file, or finds the one an earlier attempt made (Google may have made it just before
 * that attempt failed), so a retry never leaves two. Throws when Google might succeed later.
 */
async function makeFile(puzzleId: string): Promise<Made> {
  const puzzle = await load(puzzleId);
  // Deleted meanwhile, or no longer waiting for a file (made already, or the job was replaced).
  if (!puzzle || puzzle.job?.status !== "creating") return {skip: true};
  const kind = puzzle.job.kind;
  // The team switched to built-in sheets, or Drive isn't set up or connected any more: the puzzle
  // uses the built-in sheet, as one made then would.
  if (puzzle.sheetsTool !== "google" || !puzzle.folderId) return {skip: true};
  const token = await new GoogleService().getAccessToken(puzzle.workspaceId).catch(() => null);
  if (!token) return {skip: true};
  const headers = {Authorization: `Bearer ${token}`, "Content-Type": "application/json"};
  // Its name ends in "[<puzzle id>]", which no other puzzle's file has.
  const name = `${puzzle.name} [${puzzleId}]`;

  const query = `'${puzzle.folderId}' in parents and name contains '[${puzzleId}]' and trashed = false`;
  const existing = await fetch(
    `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({q: query, fields: "files(id)"}).toString()}`,
    {headers}
  );
  const lookupProblem = await check(existing, "look for the file");
  if (lookupProblem) return {failed: lookupProblem};
  const found = listSchema.parse(await existing.json()).files?.[0];
  if (found) return {fileId: found.id};

  const response =
    puzzle.templateFileId && kind === "google_spreadsheet"
      ? await fetch(`https://www.googleapis.com/drive/v3/files/${puzzle.templateFileId}/copy`, {
          method: "POST",
          headers,
          body: JSON.stringify({name, parents: [puzzle.folderId]}),
        })
      : await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers,
          body: JSON.stringify({name, parents: [puzzle.folderId], mimeType: mimeType(kind)}),
        });
  const problem = await check(response, "make the file");
  if (problem) return {failed: problem};
  return {fileId: fileSchema.parse(await response.json()).id};
}

const mimeType = (kind: Kind) =>
  kind === "google_spreadsheet"
    ? "application/vnd.google-apps.spreadsheet"
    : "application/vnd.google-apps.drawing";

/**
 * Throws for a failure worth retrying (rate limits, Google's own errors); returns what went wrong
 * for one that isn't (no access to the folder or template, say); undefined when it worked.
 */
async function check(response: Response, what: string): Promise<string | undefined> {
  if (response.ok) return undefined;
  const text = await response.text();
  let message = text.slice(0, 200);
  try {
    message = googleErrorSchema.parse(JSON.parse(text)).error.message;
  } catch {
    // Not Google's usual error body: the start of the text will do.
  }
  // Google no longer accepts WOW's sign-in: retrying won't help until an owner reconnects Drive.
  if (response.status === 401) return DRIVE_DISCONNECTED_DETAIL;
  const detail = `Google Drive couldn't ${what} (${response.status}): ${message}`;
  if (response.status === 429 || response.status >= 500) throw new Error(detail);
  return detail;
}

const googleErrorSchema = z.object({error: z.object({message: z.string()})});

/** Records the outcome on the puzzle, and the room tells everyone. */
async function save(puzzleId: string, made: Made) {
  const puzzle = await load(puzzleId);
  if ("skip" in made) {
    // No file to wait for: the puzzle goes back to the built-in sheet.
    if (puzzle?.job?.status === "creating") {
      await db
        .update(schema.puzzle)
        .set({googleFileJob: null})
        .where(eq(schema.puzzle.id, puzzleId));
      await invalidateWorkspace(puzzle.workspaceId);
    }
    return;
  }
  if ("failed" in made) {
    if (!puzzle?.job) return;
    await db
      .update(schema.puzzle)
      .set({googleFileJob: {...puzzle.job, status: "failed", detail: made.failed}})
      .where(eq(schema.puzzle.id, puzzleId));
    await invalidateWorkspace(puzzle.workspaceId);
    return;
  }
  const kind = puzzle?.job?.kind ?? "google_spreadsheet";
  const saved = await db
    .update(schema.puzzle)
    .set({
      googleSpreadsheetId: kind === "google_spreadsheet" ? made.fileId : null,
      googleDrawingId: kind === "google_drawing" ? made.fileId : null,
      googleFileJob: null,
    })
    // Only while it still has no file (a retry may have raced this one).
    .where(
      and(
        eq(schema.puzzle.id, puzzleId),
        isNull(schema.puzzle.googleSpreadsheetId),
        isNull(schema.puzzle.googleDrawingId)
      )
    )
    .returning({id: schema.puzzle.id});
  if (saved.length > 0 && puzzle) {
    await invalidateWorkspace(puzzle.workspaceId);
    return;
  }
  // Deleted while its file was being made (its cleanup didn't know about the file): bin it.
  if (!puzzle) {
    const deleted = await db
      .select({workspaceId: schema.deletedPuzzle.workspaceId})
      .from(schema.deletedPuzzle)
      .where(eq(schema.deletedPuzzle.id, puzzleId))
      .get();
    const token =
      deleted && (await new GoogleService().getAccessToken(deleted.workspaceId).catch(() => null));
    if (token) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${made.fileId}`, {
        method: "DELETE",
        headers: {Authorization: `Bearer ${token}`},
      });
    }
  }
}

/** Starts making the puzzle's Google file. Its `googleFileJob` must already say "creating". */
export async function startPuzzleSheet(puzzleId: string) {
  try {
    await env.PUZZLE_SHEET_WORKFLOW.create({params: {puzzleId}});
  } catch (error) {
    console.error("Couldn't start making a puzzle's Google file", error);
    // Shown as failed rather than "being made" forever, so someone can try again from its page.
    await save(puzzleId, {failed: "WOW couldn't start making it."});
  }
}
