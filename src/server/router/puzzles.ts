import {ORPCError} from "@orpc/client";
import {waitUntil} from "cloudflare:workers";
import {and, eq, isNull} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {invariant} from "@/lib/invariant";

import {getWorkspaceRoom} from "../do/workspace";
import {preauthorize, procedure} from "./base";

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
          name: z.string(),
          tags: z.array(z.string()),
          link: z.url().or(z.string().length(0)),
          worksheetType: z.enum(["google_spreadsheet", "google_drawing"]),
        })
      )
    )
    .handler(async ({context, input}) => {
      let workspace;
      if ("roundId" in input) {
        workspace = (
          await db
            .select()
            .from(schema.organization)
            .innerJoin(schema.round, eq(schema.organization.id, schema.round.workspaceId))
            .where(eq(schema.round.id, input.roundId))
        )[0]?.organization;
      } else {
        workspace = (
          await db
            .select()
            .from(schema.organization)
            .innerJoin(schema.round, eq(schema.organization.id, schema.round.workspaceId))
            .innerJoin(schema.puzzle, eq(schema.round.id, schema.puzzle.roundId))
            .where(
              and(eq(schema.puzzle.id, input.parentPuzzleId), eq(schema.puzzle.isMetaPuzzle, true))
            )
        )[0]?.organization;
      }
      if (!workspace) {
        throw new ORPCError("NOT_FOUND");
      }

      const roundId =
        "roundId" in input
          ? input.roundId
          : await db
              .select({roundId: schema.puzzle.roundId})
              .from(schema.puzzle)
              .where(eq(schema.puzzle.id, input.parentPuzzleId))
              .then(rows => rows[0]?.roundId);
      if (!roundId) {
        throw new ORPCError("NOT_FOUND", {message: "Round not found"});
      }

      const puzzle = await db
        .insert(schema.puzzle)
        .values({
          name: input.name,
          tags: input.tags,
          link: input.link,
          roundId,
          isMetaPuzzle: input.type === "meta-puzzle",
          parentPuzzleId: "parentPuzzleId" in input ? input.parentPuzzleId : null,
        })
        .returning()
        .then(rows => rows[0]);
      invariant(puzzle);

      const googleAccessToken = await context.google.getAccessToken(workspace.id);
      if (googleAccessToken) {
        let resp;
        if (workspace.googleTemplateFileId && input.worksheetType === "google_spreadsheet") {
          resp = await (
            await fetch(
              `https://www.googleapis.com/drive/v3/files/${workspace.googleTemplateFileId}/copy`,
              {
                method: "POST",
                headers: {Authorization: `Bearer ${googleAccessToken}`},
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
              headers: {Authorization: `Bearer ${googleAccessToken}`},
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
              input.worksheetType === "google_drawing"
                ? z.object({id: z.string()}).parse(resp).id
                : null,
          })
          .where(eq(schema.puzzle.id, puzzle.id));
        if (input.type === "meta-puzzle") {
          if (input.assignUnassignedPuzzles) {
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
        }
      }
      await context.activityLog.createPuzzle({
        subType: "create",
        puzzleId: puzzle.id,
        puzzleName: puzzle.name,
        workspaceId: workspace.id,
      });
      await (await getWorkspaceRoom(workspace.id)).invalidate();
      waitUntil(context.discord.sync(workspace.id));

      return puzzle;
    }),

  update: procedure
    .input(
      z.object({
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
    .handler(async ({context, input}) => {
      const puzzle = await db
        .select({
          id: schema.puzzle.id,
          name: schema.puzzle.name,
          answer: schema.puzzle.answer,
          status: schema.puzzle.status,
          importance: schema.puzzle.importance,
          round: {workspaceId: schema.round.workspaceId},
        })
        .from(schema.puzzle)
        .where(eq(schema.puzzle.id, input.id))
        .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
        .then(rows => rows[0]);
      invariant(puzzle);
      if (input.answer !== undefined && input.answer !== "" && input.answer !== puzzle.answer) {
        await context.activityLog.createPuzzle({
          subType: "updateAnswer",
          puzzleId: puzzle.id,
          puzzleName: puzzle.name,
          workspaceId: puzzle.round.workspaceId,
          field: input.answer ?? "",
        });
        // if (puzzle.status !== "solved" && puzzle.status !== "backsolved") {
        //   input.status = "solved";
        // }
      }
      if (input.status !== undefined && input.status !== puzzle.status) {
        await context.activityLog.createPuzzle({
          subType: "updateStatus",
          puzzleId: puzzle.id,
          puzzleName: puzzle.name,
          workspaceId: puzzle.round.workspaceId,
          field: input.status ?? "None",
        });
        if (input.status === "solved") {
          waitUntil(
            context.notification.broadcast(puzzle.round.workspaceId, {
              type: "solved",
              message: `Puzzle ${puzzle.name} was solved!`,
            })
          );
        }
      }
      if (input.importance !== undefined && input.importance !== puzzle.importance) {
        await context.activityLog.createPuzzle({
          subType: "updateImportance",
          puzzleId: puzzle.id,
          puzzleName: puzzle.name,
          workspaceId: puzzle.round.workspaceId,
          field: input.importance ?? "None",
        });
      }

      // Update puzzle in database
      let roundId = undefined;
      if (input.parentPuzzleId !== undefined && input.parentPuzzleId !== null) {
        roundId = (
          await db
            .select({id: schema.round.id})
            .from(schema.round)
            .where(eq(schema.round.id, input.parentPuzzleId))
        )[0]?.id;
        if (roundId) {
          input.parentPuzzleId = null;
        } else {
          roundId = (
            await db
              .select({roundId: schema.puzzle.roundId})
              .from(schema.puzzle)
              .where(eq(schema.puzzle.id, input.parentPuzzleId))
          )[0]?.roundId;
          invariant(roundId);
        }
      }

      let commentUpdatedAt = undefined;
      let commentUpdatedBy = undefined;
      if (input.comment !== undefined) {
        commentUpdatedAt = new Date();
        commentUpdatedBy = context.session.user.displayUsername;
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
      await (await getWorkspaceRoom(puzzle.round.workspaceId)).invalidate();
      waitUntil(context.discord.sync(puzzle.round.workspaceId));
    }),

  delete: procedure.input(z.string()).handler(async ({context, input}) => {
    const puzzle = await db
      .select({
        id: schema.puzzle.id,
        name: schema.puzzle.name,
        round: {workspaceId: schema.round.workspaceId},
        googleSpreadsheetId: schema.puzzle.googleSpreadsheetId,
        googleDrawingId: schema.puzzle.googleDrawingId,
      })
      .from(schema.puzzle)
      .where(eq(schema.puzzle.id, input))
      .innerJoin(schema.round, eq(schema.puzzle.roundId, schema.round.id))
      .then(rows => rows[0]);
    invariant(puzzle);
    await context.activityLog.createPuzzle({
      subType: "delete",
      puzzleId: puzzle.id,
      puzzleName: puzzle.name,
      workspaceId: puzzle.round.workspaceId,
    });

    await db.delete(schema.puzzle).where(eq(schema.puzzle.id, input));

    if (puzzle.googleSpreadsheetId || puzzle.googleDrawingId) {
      const googleAccessToken = await context.google.getAccessToken(puzzle.round.workspaceId);
      if (googleAccessToken) {
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${puzzle.googleSpreadsheetId || puzzle.googleDrawingId}`,
          {method: "DELETE", headers: {Authorization: `Bearer ${googleAccessToken}`}}
        );
      }
    }
    await (await getWorkspaceRoom(puzzle.round.workspaceId)).invalidate();
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
};
