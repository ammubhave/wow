import { z } from "zod";

import { procedure, router } from "../trpc";

export const puzzlesRouter = router({
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
            .object({
              type: z.literal("puzzle"),
            })
            .and(
              z.union([
                z.object({
                  roundId: z.string(),
                }),
                z.object({
                  parentPuzzleId: z.string(),
                }),
              ]),
            ),
        ]),
        z.object({
          name: z.string(),
          link: z.string().url().or(z.string().length(0)),
          worksheetType: z.enum(["google_spreadsheet", "google_drawing"]),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      let workspace;
      if ("roundId" in input) {
        workspace = await ctx.db.workspace.findFirstOrThrow({
          where: {
            rounds: {
              some: {
                id: input.roundId,
              },
            },
          },
        });
      } else {
        workspace = await ctx.db.workspace.findFirstOrThrow({
          where: {
            rounds: {
              some: {
                puzzles: {
                  some: {
                    id: input.parentPuzzleId,
                    isMetaPuzzle: true,
                  },
                },
              },
            },
          },
        });
      }

      const roundId =
        "roundId" in input
          ? input.roundId
          : (
              await ctx.db.puzzle.findFirstOrThrow({
                where: {
                  id: input.parentPuzzleId,
                },
              })
            ).roundId;

      const puzzle = await ctx.db.puzzle.create({
        data: {
          name: input.name,
          link: input.link,
          roundId,
          isMetaPuzzle: input.type === "meta-puzzle",
          parentPuzzleId:
            "parentPuzzleId" in input ? input.parentPuzzleId : null,
        },
        include: {
          childPuzzles: true,
        },
      });

      const googleAccessToken = await ctx.google.getAccessToken(workspace.id);
      if (googleAccessToken) {
        let resp;
        if (
          workspace.googleTemplateFileId &&
          input.worksheetType === "google_spreadsheet"
        ) {
          resp = await (
            await fetch(
              `https://www.googleapis.com/drive/v3/files/${workspace.googleTemplateFileId}/copy`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${googleAccessToken}`,
                },
                body: JSON.stringify({
                  name: `${input.name} [${puzzle.id}]`,
                  parents: [workspace.googleFolderId],
                }),
              },
            )
          ).json();
        } else {
          resp = await (
            await fetch(`https://www.googleapis.com/drive/v3/files`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${googleAccessToken}`,
              },
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

        await ctx.db.puzzle.update({
          data: {
            googleSpreadsheetId:
              input.worksheetType === "google_spreadsheet"
                ? z
                    .object({
                      id: z.string(),
                    })
                    .parse(resp).id
                : undefined,
            googleDrawingId:
              input.worksheetType === "google_drawing"
                ? z
                    .object({
                      id: z.string(),
                    })
                    .parse(resp).id
                : undefined,
          },
          where: {
            id: puzzle.id,
          },
        });
        if (input.type === "meta-puzzle") {
          if (input.assignUnassignedPuzzles) {
            await ctx.db.puzzle.updateMany({
              data: {
                parentPuzzleId: puzzle.id,
              },
              where: {
                roundId: input.roundId,
                parentPuzzleId: null,
                isMetaPuzzle: false,
              },
            });
          }
        }
      }

      ctx.waitUntil(
        (async () => {
          await Promise.allSettled([
            ctx.notification.broadcast(workspace.id, {
              type: "notification",
              paths: [
                {
                  path: ["rounds", "list"],
                  input: {
                    workspaceId: workspace.id,
                  },
                },
              ],
            }),
            ctx.discord.sync(workspace.id),
          ]);
        })(),
      );

      return puzzle;
    }),

  update: procedure
    .input(
      z.object({
        id: z.string(),
        parentPuzzleId: z.string().nullable().optional(),
        name: z.string().min(1).optional(),
        answer: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        importance: z.string().nullable().optional(),
        link: z.string().nullable().optional(),
        googleSpreadsheetId: z.string().nullable().optional(),
        googleDrawingId: z.string().nullable().optional(),
        comment: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Update puzzle in database
      const {
        round: { workspaceId },
      } = await ctx.db.puzzle.update({
        data: {
          parentPuzzleId: input.parentPuzzleId,
          name: input.name,
          answer: input.answer,
          status: input.status,
          importance: input.importance,
          link: input.link,
          googleSpreadsheetId: input.googleSpreadsheetId?.replace(
            /https:\/\/docs.google.com\/spreadsheets\/d\/([a-zA-Z0-9]+)\/edit.*/g,
            "$1",
          ),
          googleDrawingId: input.googleDrawingId?.replace(
            /https:\/\/docs.google.com\/drawings\/d\/([a-zA-Z0-9]+)\/edit.*/g,
            "$1",
          ),
          comment: input.comment,
        },
        where: {
          id: input.id,
        },
        select: {
          round: {
            select: {
              workspaceId: true,
            },
          },
        },
      });

      // Deferred: Broadcast notification and sync discord
      ctx.waitUntil(
        (async () => {
          await Promise.allSettled([
            ctx.notification.broadcast(workspaceId, {
              type: "notification",
              paths: [
                {
                  path: ["rounds", "list"],
                  input: {
                    workspaceId,
                  },
                },
              ],
            }),
            ctx.discord.sync(workspaceId),
          ]);
        })(),
      );
    }),

  delete: procedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const {
      round: { workspaceId },
      googleSpreadsheetId,
      googleDrawingId,
    } = await ctx.db.puzzle.delete({
      where: {
        id: input,
      },
      select: {
        round: {
          select: {
            workspaceId: true,
          },
        },
        googleSpreadsheetId: true,
        googleDrawingId: true,
      },
    });

    // Deferred: Broadcast notification, sync discord, and delete google spreadsheet
    ctx.waitUntil(
      (async () => {
        let deleteGoogleSpreadsheetPromise: Promise<void> | undefined;
        if (googleSpreadsheetId || googleDrawingId) {
          deleteGoogleSpreadsheetPromise = (async () => {
            const googleAccessToken =
              await ctx.google.getAccessToken(workspaceId);
            if (googleAccessToken) {
              await fetch(
                `https://www.googleapis.com/drive/v3/files/${googleSpreadsheetId || googleDrawingId}`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${googleAccessToken}`,
                  },
                },
              );
            }
          })();
        }
        await Promise.allSettled([
          ...(deleteGoogleSpreadsheetPromise
            ? [deleteGoogleSpreadsheetPromise]
            : []),
          ctx.notification.broadcast(workspaceId, {
            type: "notification",
            paths: [
              {
                path: ["rounds", "list"],
                input: {
                  workspaceId,
                },
              },
            ],
          }),
          ctx.discord.sync(workspaceId),
        ]);
      })(),
    );
  }),
});
