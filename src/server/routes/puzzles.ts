import { createId } from "@paralleldrive/cuid2";
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
                  metaPuzzleId: z.string(),
                }),
              ]),
            ),
        ]),
        z.object({
          name: z.string(),
          link: z.string().url().or(z.string().length(0)),
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
                metaPuzzles: {
                  some: {
                    id: input.metaPuzzleId,
                  },
                },
              },
            },
          },
        });
      }

      let puzzle;
      if (input.type === "puzzle") {
        puzzle = await ctx.db.puzzle.create({
          data: {
            name: input.name,
            link: input.link,
            ...("roundId" in input
              ? { roundId: input.roundId }
              : { metaPuzzleId: input.metaPuzzleId }),
          },
        });
      } else {
        puzzle = await ctx.db.metaPuzzle.create({
          data: {
            id: `meta-${createId()}`,
            name: input.name,
            roundId: input.roundId,
            link: input.link,
          },
        });
      }

      const googleAccessToken = await ctx.getGoogleToken(workspace.id);
      if (googleAccessToken) {
        let resp;
        if (workspace.googleTemplateFileId) {
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
                mimeType: "application/vnd.google-apps.spreadsheet",
              }),
            })
          ).json();
        }

        if (input.type === "meta-puzzle") {
          await ctx.db.$transaction(async (tx) => {
            await tx.metaPuzzle.update({
              data: {
                googleSpreadsheetId: z
                  .object({
                    id: z.string(),
                  })
                  .parse(resp).id,
              },
              where: {
                id: puzzle.id,
              },
            });
            if (input.assignUnassignedPuzzles) {
              await tx.puzzle.updateMany({
                data: {
                  roundId: null,
                  metaPuzzleId: puzzle.id,
                },
                where: {
                  roundId: input.roundId,
                },
              });
            }
          });
        } else {
          await ctx.db.puzzle.update({
            data: {
              googleSpreadsheetId: z
                .object({
                  id: z.string(),
                })
                .parse(resp).id,
            },
            where: {
              id: puzzle.id,
            },
          });
        }
      }

      ctx.waitUntil(
        (async () => {
          await Promise.allSettled([
            ctx.broadcastNotification(workspace.id, {
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
            ctx.syncDiscord(workspace.id),
          ]);
        })(),
      );

      return puzzle;
    }),

  update: procedure
    .input(
      z.object({
        id: z.string(),
        metaPuzzleId: z.string().nullable().optional(),
        name: z.string().min(1).optional(),
        answer: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        importance: z.string().nullable().optional(),
        link: z.string().nullable().optional(),
        googleSpreadsheetId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Update puzzle in database
      let workspaceId;
      if (input.id.startsWith("meta-")) {
        const puzzle = await ctx.db.metaPuzzle.update({
          data: {
            metaPuzzleId: input.metaPuzzleId,
            name: input.name,
            answer: input.answer,
            status: input.status,
            importance: input.importance,
            link: input.link,
            googleSpreadsheetId: input.googleSpreadsheetId?.replace(
              /https:\/\/docs.google.com\/spreadsheets\/d\/([a-zA-Z0-9]+)\/edit.*/g,
              "$1",
            ),
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
        workspaceId = puzzle.round.workspaceId;
      } else {
        const puzzle = await ctx.db.puzzle.update({
          data: {
            metaPuzzleId: input.metaPuzzleId,
            roundId:
              input.metaPuzzleId !== null && input.metaPuzzleId !== undefined
                ? null
                : undefined,
            name: input.name,
            answer: input.answer,
            status: input.status,
            importance: input.importance,
            link: input.link,
            googleSpreadsheetId: input.googleSpreadsheetId?.replace(
              /https:\/\/docs.google.com\/spreadsheets\/d\/([a-zA-Z0-9]+)\/edit.*/g,
              "$1",
            ),
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
            metaPuzzle: {
              select: {
                round: {
                  select: {
                    workspaceId: true,
                  },
                },
              },
            },
          },
        });
        workspaceId =
          // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
          puzzle.round?.workspaceId ?? puzzle.metaPuzzle?.round?.workspaceId!;
      }

      // Deferred: Broadcast notification and sync discord
      ctx.waitUntil(
        (async () => {
          await Promise.allSettled([
            ctx.broadcastNotification(workspaceId, {
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
            ctx.syncDiscord(workspaceId),
          ]);
        })(),
      );
    }),

  delete: procedure.input(z.string()).mutation(async ({ ctx, input }) => {
    let workspaceId;
    let googleSpreadsheetId;
    if (input.startsWith("meta-")) {
      const puzzle = (workspaceId = await ctx.db.$transaction(async (tx) => {
        const { roundId } = await tx.metaPuzzle.findFirstOrThrow({
          select: {
            roundId: true,
          },
          where: {
            id: input,
          },
        });
        await tx.puzzle.updateMany({
          where: {
            metaPuzzleId: input,
          },
          data: {
            metaPuzzleId: null,
            roundId: roundId,
          },
        });
        return await tx.metaPuzzle.delete({
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
          },
        });
      }));
      workspaceId = puzzle.round.workspaceId;
      googleSpreadsheetId = puzzle.googleSpreadsheetId;
    } else {
      const puzzle = await ctx.db.puzzle.delete({
        where: {
          id: input,
        },
        select: {
          round: {
            select: {
              workspaceId: true,
            },
          },
          metaPuzzle: {
            select: {
              round: {
                select: {
                  workspaceId: true,
                },
              },
            },
          },
          googleSpreadsheetId: true,
        },
      });
      workspaceId =
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        puzzle.round?.workspaceId ?? puzzle.metaPuzzle?.round?.workspaceId!;
      googleSpreadsheetId = puzzle.googleSpreadsheetId;
    }

    // Deferred: Broadcast notification, sync discord, and delete google spreadsheet
    ctx.waitUntil(
      (async () => {
        let deleteGoogleSpreadsheetPromise: Promise<void> | undefined;
        if (googleSpreadsheetId) {
          deleteGoogleSpreadsheetPromise = (async () => {
            const googleAccessToken = await ctx.getGoogleToken(workspaceId);
            if (googleAccessToken) {
              await fetch(
                `https://www.googleapis.com/drive/v3/files/${googleSpreadsheetId}`,
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
          ctx.broadcastNotification(workspaceId, {
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
          ctx.syncDiscord(workspaceId),
        ]);
      })(),
    );
  }),
});
