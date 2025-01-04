import { string, z } from "zod";

import { procedure, router } from "../trpc";

export const roundsRouter = router({
  list: procedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.round.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          metaPuzzles: {
            include: {
              puzzles: true,
              metaPuzzles: true,
            },
          },
          unassignedPuzzles: true,
        },
      });
    }),
  
  listPuzzles: procedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rounds = await ctx.db.round.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          metaPuzzles: {
            include: {
              puzzles: true,
              metaPuzzles: true,
            },
          },
          unassignedPuzzles: true,
        },
      });

      const roundFlattenedPuzzles: Array<{id: string, puzzles: Array<string>}> = [];
      rounds.forEach((round) => {
        // This ignores metaPuzzle.metaPuzzles (e.g. meta-metas).
        const flattenedPuzzles: Array<string> =
          [
            ...round.metaPuzzles?.flatMap((metaPuzzle) => [
              metaPuzzle.id,
              ...metaPuzzle.puzzles.map((puzzle) => puzzle.id),
            ]),
            ...round.unassignedPuzzles?.map(
              (puzzle) => puzzle.id
            ),
          ];
        roundFlattenedPuzzles.push({id: round.id, puzzles: flattenedPuzzles});
      });
      return roundFlattenedPuzzles;
    }),
    
  create: procedure
    .input(z.object({ workspaceId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Create round in database
      const round = await ctx.db.round.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
        },
      });

      // Deferred: Broadcast notification and sync discord
      ctx.waitUntil(
        (async () => {
          await Promise.allSettled([
            ctx.broadcastNotification(input.workspaceId, {
              type: "notification",
              paths: [
                {
                  path: ["rounds", "list"],
                  input: {
                    workspaceId: input.workspaceId,
                  },
                },
              ],
            }),
            ctx.syncDiscord(input.workspaceId),
          ]);
        })(),
      );

      return round;
    }),

  update: procedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Update round in database
      const { workspaceId } = await ctx.db.round.update({
        where: {
          id: input.id,
        },
        data: {
          name: input.name,
        },
        select: {
          workspaceId: true,
        },
      });

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
    // Delete round from database
    await ctx.db.round.delete({ where: { id: input } });

    // Deferred: Broadcast notification and sync discord
    ctx.waitUntil(
      (async () => {
        const workspace = await ctx.db.workspace.findFirstOrThrow({
          select: { id: true },
          where: {
            rounds: {
              some: {
                id: input,
              },
            },
          },
        });
        await Promise.all([
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
  }),
});
