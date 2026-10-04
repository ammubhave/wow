import {ORPCError} from "@orpc/server";
import {env, waitUntil} from "cloudflare:workers";
import {and, desc, eq, isNull, sql} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {invariant} from "@/lib/invariant";

import {invalidateWorkspace} from "../do/workspace";
import {trackServerEvent} from "../posthog";
import {preauthorize, procedure} from "./base";

/** Creates the puzzle's Google Drive worksheet (if Drive is connected) and records its id. */
async function createPuzzleWorksheet(
  context: {google: {getAccessToken: (workspaceId: string) => Promise<string | null | undefined>}},
  workspace: {id: string; googleFolderId: string | null; googleTemplateFileId: string | null},
  puzzle: {id: string},
  input: {name: string; worksheetType: "google_spreadsheet" | "google_drawing"}
) {
  const googleAccessToken = await context.google.getAccessToken(workspace.id);
  if (!googleAccessToken) return;
  let resp;
  if (workspace.googleTemplateFileId && input.worksheetType === "google_spreadsheet") {
    resp = await (
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${workspace.googleTemplateFileId}/copy`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `${input.name} [${puzzle.id}]`,
            parents: [workspace.googleFolderId],
          }),
        }
      )
    ).json();
  } else {
    resp = await (
      await fetch(`https://www.googleapis.com/drive/v3/files`, {
        method: "POST",
        headers: {Authorization: `Bearer ${googleAccessToken}`, "Content-Type": "application/json"},
        body: JSON.stringify({
          name: `${input.name} [${puzzle.id}]`,
          parents: [workspace.googleFolderId],
          mimeType:
            input.worksheetType === "google_spreadsheet"
              ? "application/vnd.google-apps.spreadsheet"
              : "application/vnd.google-apps.drawing",
        }),
      })
    ).json();
  }

  await db
    .update(schema.puzzle)
    .set({
      googleSpreadsheetId:
        input.worksheetType === "google_spreadsheet"
          ? z.object({id: z.string()}).parse(resp).id
          : null,
      googleDrawingId:
        input.worksheetType === "google_drawing" ? z.object({id: z.string()}).parse(resp).id : null,
    })
    .where(eq(schema.puzzle.id, puzzle.id));
  await invalidateWorkspace(workspace.id);
}

/** The most time one `recordTime` call can add (the page saves about every minute). */
export const MAX_TIME_BATCH_SECONDS = 120;
const HOUR_MS = 3_600_000;

export const puzzlesRouter = {
  create: procedure
    .input(
      z.intersection(
        z.union([
          z.object({
            type: z.literal("meta-puzzle"),
            roundId: z.string(),
            assignUnassignedPuzzles: z.boolean(),
          }),
          z
            .object({type: z.literal("puzzle")})
            .and(
              z.union([z.object({roundId: z.string()}), z.object({parentPuzzleId: z.string()})])
            ),
        ]),
        z.object({
          workspaceSlug: z.string(),
          // Client-generated so the optimistic row and the real one share an id.
          id: z.uuid().optional(),
          name: z.string(),
          tags: z.array(z.string()),
          link: z.url().or(z.string().length(0)),
          worksheetType: z.enum(["google_spreadsheet", "google_drawing"]),
        })
      )
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const workspace = context.workspace;
      // Resolve the round, scoped to the caller's workspace (ids come from input).
      const roundId =
        "roundId" in input
          ? (
              await db
                .select({id: schema.round.id})
                .from(schema.round)
                .where(
                  and(
                    eq(schema.round.id, input.roundId),
                    eq(schema.round.workspaceId, workspace.id)
                  )
                )
                .get()
            )?.id
          : (
              await db
                .select({roundId: schema.puzzle.roundId})
                .from(schema.puzzle)
                .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
                .where(
                  and(
                    eq(schema.puzzle.id, input.parentPuzzleId),
                    eq(schema.puzzle.isMetaPuzzle, true),
                    eq(schema.round.workspaceId, workspace.id)
                  )
                )
                .get()
            )?.roundId;
      if (!roundId) {
        throw new ORPCError("NOT_FOUND", {message: "Round not found"});
      }

      const puzzle = await db
        .insert(schema.puzzle)
        .values({
          id: input.id,
          name: input.name,
          tags: input.tags,
          link: input.link,
          roundId,
          isMetaPuzzle: input.type === "meta-puzzle",
          parentPuzzleId: "parentPuzzleId" in input ? input.parentPuzzleId : null,
          importance: "normal",
        })
        .returning()
        .then(rows => rows[0]);
      invariant(puzzle);

      // Independent of Google Drive being connected.
      if (input.type === "meta-puzzle" && input.assignUnassignedPuzzles) {
        await db
          .update(schema.puzzle)
          .set({parentPuzzleId: puzzle.id})
          .where(
            and(
              eq(schema.puzzle.roundId, roundId),
              isNull(schema.puzzle.parentPuzzleId),
              eq(schema.puzzle.isMetaPuzzle, false)
            )
          );
      }
      await context.activityLog.createPuzzle({
        subType: "create",
        puzzleId: puzzle.id,
        puzzleName: puzzle.name,
        workspaceId: workspace.id,
      });
      // Respond (and broadcast the new row) right away; the Drive worksheet can take a second or two,
      // so it is created in the background and broadcast again once its id is known.
      await invalidateWorkspace(workspace.id);
      waitUntil(
        createPuzzleWorksheet(context, workspace, puzzle, input).catch((error: unknown) =>
          console.error("Failed to create the puzzle's Google Drive worksheet", error)
        )
      );
      waitUntil(context.discord.sync(workspace.id));

      return puzzle;
    }),

  update: procedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        id: z.string(),
        parentPuzzleId: z.string().nullable().optional(),
        name: z.string().min(1).optional(),
        answer: z
          .string()
          .transform(v => v.toUpperCase())
          .nullable()
          .optional(),
        status: z.string().nullable().optional(),
        importance: z.string().nullable().optional(),
        link: z.string().nullable().optional(),
        comment: z
          .string()
          .transform(val => (val.length === 0 ? null : val))
          .nullable()
          .optional(),
        isMetaPuzzle: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const workspaceId = context.workspace.id;
      const puzzle = await db
        .select({
          id: schema.puzzle.id,
          name: schema.puzzle.name,
          answer: schema.puzzle.answer,
          status: schema.puzzle.status,
          importance: schema.puzzle.importance,
          roundId: schema.puzzle.roundId,
          isMetaPuzzle: schema.puzzle.isMetaPuzzle,
        })
        .from(schema.puzzle)
        .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
        .where(and(eq(schema.puzzle.id, input.id), eq(schema.round.workspaceId, workspaceId)))
        .get();
      if (!puzzle) throw new ORPCError("NOT_FOUND");

      // `parentPuzzleId` is either a round id (move to that round, unassigned) or a puzzle id
      // (assign to that meta, moving into its round). Both are scoped to the caller's workspace.
      let roundId = undefined;
      if (input.parentPuzzleId !== undefined && input.parentPuzzleId !== null) {
        if (input.parentPuzzleId === puzzle.id) {
          throw new ORPCError("BAD_REQUEST", {message: "A puzzle can't be its own parent."});
        }
        const [targetRound, targetParent] = await Promise.all([
          db
            .select({id: schema.round.id})
            .from(schema.round)
            .where(
              and(
                eq(schema.round.id, input.parentPuzzleId),
                eq(schema.round.workspaceId, workspaceId)
              )
            )
            .get(),
          db
            .select({roundId: schema.puzzle.roundId})
            .from(schema.puzzle)
            .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
            .where(
              and(
                eq(schema.puzzle.id, input.parentPuzzleId),
                eq(schema.round.workspaceId, workspaceId)
              )
            )
            .get(),
        ]);
        if (targetRound) {
          roundId = targetRound.id;
          input.parentPuzzleId = null;
        } else if (targetParent) {
          roundId = targetParent.roundId;
        } else {
          throw new ORPCError("NOT_FOUND", {message: "Round or parent puzzle not found"});
        }
      }

      const activityLogWrites: Promise<void>[] = [];
      if (input.answer !== undefined && input.answer !== "" && input.answer !== puzzle.answer) {
        activityLogWrites.push(
          context.activityLog.createPuzzle({
            subType: "updateAnswer",
            puzzleId: puzzle.id,
            puzzleName: puzzle.name,
            workspaceId,
            field: input.answer ?? "",
          })
        );
      }
      if (input.status !== undefined && input.status !== puzzle.status) {
        activityLogWrites.push(
          context.activityLog.createPuzzle({
            subType: "updateStatus",
            puzzleId: puzzle.id,
            puzzleName: puzzle.name,
            workspaceId,
            field: input.status ?? "None",
          })
        );

        const inputSolved = input.status === "solved" || input.status === "backsolved";
        const puzzleSolved = puzzle.status === "solved" || puzzle.status === "backsolved";
        if (inputSolved && inputSolved !== puzzleSolved) {
          waitUntil(
            context.notification.broadcast(workspaceId, {
              type: "solved",
              message: `Puzzle ${puzzle.name} was solved!`,
              puzzleId: puzzle.id,
              puzzleName: input.name ?? puzzle.name,
              answer: (input.answer ?? puzzle.answer) || null,
              isMeta: input.isMetaPuzzle ?? puzzle.isMetaPuzzle,
              by: {id: context.session.user.id, name: context.session.user.name},
            })
          );
          trackServerEvent("puzzle_solved", {
            distinctId: context.session.user.id,
            workspaceId,
            properties: {
              puzzleId: puzzle.id,
              status: input.status,
              isMeta: input.isMetaPuzzle ?? puzzle.isMetaPuzzle,
            },
          });
        }
      }
      if (input.importance !== undefined && input.importance !== puzzle.importance) {
        activityLogWrites.push(
          context.activityLog.createPuzzle({
            subType: "updateImportance",
            puzzleId: puzzle.id,
            puzzleName: puzzle.name,
            workspaceId,
            field: input.importance ?? "normal",
          })
        );
      }
      await Promise.all(activityLogWrites);

      let commentUpdatedAt = undefined;
      let commentUpdatedBy = undefined;
      if (input.comment !== undefined) {
        commentUpdatedAt = new Date();
        commentUpdatedBy = context.session.user.name;
      }
      await db
        .update(schema.puzzle)
        .set({
          roundId,
          parentPuzzleId: input.parentPuzzleId,
          name: input.name,
          answer: input.answer,
          status: input.status,
          importance: input.importance,
          link: input.link,
          comment: input.comment,
          commentUpdatedAt,
          commentUpdatedBy,
          isMetaPuzzle: input.isMetaPuzzle,
          tags: input.tags,
        })
        .where(eq(schema.puzzle.id, input.id));
      await invalidateWorkspace(workspaceId);
      // Discord channels only depend on round membership, name, status and meta-ness: skip the
      // sync (which re-reads every round and puzzle) for comment/tag/link/answer-only edits.
      const affectsDiscord =
        (roundId !== undefined && roundId !== puzzle.roundId) ||
        (input.name !== undefined && input.name !== puzzle.name) ||
        (input.status !== undefined && input.status !== puzzle.status) ||
        (input.isMetaPuzzle !== undefined && input.isMetaPuzzle !== puzzle.isMetaPuzzle);
      if (affectsDiscord) waitUntil(context.discord.sync(workspaceId));
    }),

  delete: procedure
    .input(z.object({workspaceSlug: z.string(), id: z.string()}))
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const puzzle = await db
        .select({
          id: schema.puzzle.id,
          name: schema.puzzle.name,
          round: {workspaceId: schema.round.workspaceId},
          googleSpreadsheetId: schema.puzzle.googleSpreadsheetId,
          googleDrawingId: schema.puzzle.googleDrawingId,
        })
        .from(schema.puzzle)
        .where(
          and(eq(schema.puzzle.id, input.id), eq(schema.round.workspaceId, context.workspace.id))
        )
        .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
        .get();
      if (!puzzle) throw new ORPCError("NOT_FOUND");
      await context.activityLog.createPuzzle({
        subType: "delete",
        puzzleId: puzzle.id,
        puzzleName: puzzle.name,
        workspaceId: puzzle.round.workspaceId,
      });

      await db.delete(schema.puzzle).where(eq(schema.puzzle.id, input.id));
      // Its chat and whiteboard (with their images) go with it, off the response path.
      waitUntil(
        Promise.all([
          env.CHAT_ROOMS.getByName(puzzle.id, {locationHint: "enam"}).clear(puzzle.id),
          env.WHITEBOARD_ROOMS.getByName(puzzle.id, {locationHint: "enam"}).clear(puzzle.id),
        ])
      );

      const googleFileId = puzzle.googleSpreadsheetId || puzzle.googleDrawingId;
      if (googleFileId) {
        // Off the response path: the puzzle is already gone from the workspace.
        waitUntil(
          (async () => {
            const googleAccessToken = await context.google.getAccessToken(puzzle.round.workspaceId);
            if (!googleAccessToken) return;
            const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${googleFileId}`, {
              method: "DELETE",
              headers: {Authorization: `Bearer ${googleAccessToken}`},
            });
            if (!resp.ok && resp.status !== 404) {
              console.error(`Failed to delete Google file ${googleFileId}: ${resp.status}`);
            }
          })()
        );
      }
      await invalidateWorkspace(puzzle.round.workspaceId);
      waitUntil(context.discord.sync(puzzle.round.workspaceId));
    }),
  get: procedure
    .input(z.object({workspaceSlug: z.string(), puzzleId: z.string()}))
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const [puzzle] = await db
        .select({name: schema.puzzle.name})
        .from(schema.puzzle)
        .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
        .where(
          and(
            eq(schema.puzzle.id, input.puzzleId),
            eq(schema.round.workspaceId, context.workspace.id)
          )
        );
      if (!puzzle) throw new ORPCError("NOT_FOUND");
      return puzzle;
    }),

  /**
   * Adds time you were active on a puzzle (its page in the focused tab, not idle), sent by the page
   * in small batches, with the hour of day where you are. A batch can't claim more time than has
   * passed since the previous one (plus slack), so these stay honest-ish stats.
   */
  recordTime: procedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        puzzleId: z.string(),
        seconds: z.number().int().min(1).max(MAX_TIME_BATCH_SECONDS),
        /** The hour of day (0–23) in the solver's own time zone. */
        localHour: z.number().int().min(0).max(23),
      })
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const puzzle = await db
        .select({id: schema.puzzle.id})
        .from(schema.puzzle)
        .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
        .where(
          and(
            eq(schema.puzzle.id, input.puzzleId),
            eq(schema.round.workspaceId, context.workspace.id)
          )
        )
        .get();
      if (!puzzle) throw new ORPCError("NOT_FOUND");
      const {seconds, updatedAt} = schema.puzzleTime;
      await db
        .insert(schema.puzzleTime)
        .values({
          userId: context.session.user.id,
          puzzleId: puzzle.id,
          workspaceId: context.workspace.id,
          hour: Math.floor(Date.now() / HOUR_MS),
          localHour: input.localHour,
          seconds: input.seconds,
        })
        .onConflictDoUpdate({
          target: [schema.puzzleTime.userId, schema.puzzleTime.puzzleId, schema.puzzleTime.hour],
          set: {
            seconds: sql`${seconds} + min(excluded.seconds, (cast(unixepoch('subsecond') * 1000 as integer) - ${updatedAt}) / 1000 + 10)`,
            updatedAt: new Date(),
          },
        });
    }),

  /** Your time on each puzzle in the workspace (most first). */
  myTimes: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}) => {
      const seconds = sql<number>`cast(sum(${schema.puzzleTime.seconds}) as integer)`;
      return db
        .select({puzzleId: schema.puzzleTime.puzzleId, seconds})
        .from(schema.puzzleTime)
        .where(
          and(
            eq(schema.puzzleTime.workspaceId, context.workspace.id),
            eq(schema.puzzleTime.userId, context.session.user.id)
          )
        )
        .groupBy(schema.puzzleTime.puzzleId)
        .orderBy(desc(seconds));
    }),

  /** Marks (or unmarks) yourself as having helped solve a puzzle: the team's honor code. */
  setContributor: procedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        puzzleId: z.string(),
        /** Always you: nobody marks someone else (it's in the input for the optimistic update). */
        userId: z.string(),
        contributed: z.boolean(),
      })
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      if (input.userId !== context.session.user.id) throw new ORPCError("FORBIDDEN");
      const puzzle = await db
        .select({id: schema.puzzle.id})
        .from(schema.puzzle)
        .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
        .where(
          and(
            eq(schema.puzzle.id, input.puzzleId),
            eq(schema.round.workspaceId, context.workspace.id)
          )
        )
        .get();
      if (!puzzle) throw new ORPCError("NOT_FOUND");
      const userId = context.session.user.id;
      if (input.contributed) {
        await db
          .insert(schema.puzzleContributor)
          .values({puzzleId: puzzle.id, userId})
          .onConflictDoNothing();
      } else {
        await db
          .delete(schema.puzzleContributor)
          .where(
            and(
              eq(schema.puzzleContributor.puzzleId, puzzle.id),
              eq(schema.puzzleContributor.userId, userId)
            )
          );
      }
      await invalidateWorkspace(context.workspace.id);
    }),
};
