import {ORPCError} from "@orpc/client";
import {waitUntil} from "cloudflare:workers";
import {and, asc, eq, isNull} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {invariant} from "@/lib/invariant";

import {preauthorize, procedure} from "./base";

export const roundsRouter = {
  list: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}) => {
      const rounds = await db.query.round.findMany({
        where: (t, {eq}) => eq(t.workspaceId, context.workspace.id),
        with: {puzzles: {with: {childPuzzles: true}}},
        orderBy: t => [asc(t.name)],
      });
      return rounds.map(round => ({
        ...round,
        unassignedPuzzles: round.puzzles.filter(
          puzzle => !puzzle.isMetaPuzzle && puzzle.parentPuzzleId === null
        ),
        metaPuzzles: round.puzzles.filter(puzzle => puzzle.isMetaPuzzle),
      }));
    }),

  create: procedure
    .input(z.object({workspaceSlug: z.string(), name: z.string()}))
    .use(preauthorize)
    .handler(async ({context, input}) => {
      // Create round in database
      const round = await db
        .insert(schema.round)
        .values({workspaceId: context.workspace.id, name: input.name})
        .returning()
        .get();

      // Deferred: Broadcast notification and sync discord
      waitUntil(
        (async () => {
          await Promise.allSettled([
            context.activityLog.createRound({
              subType: "create",
              workspaceId: context.workspace.id,
              roundId: round.id,
              roundName: round.name,
            }),
            context.notification.broadcast(context.workspace.id, {type: "invalidate"}),
            context.discord.sync(context.workspace.id),
          ]);
        })()
      );

      return round;
    }),

  update: procedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        status: z.string().nullable().optional(),
      })
    )
    .handler(async ({context, input}) => {
      // Update round in database
      const [result] = await db
        .update(schema.round)
        .set({name: input.name, status: input.status})
        .where(eq(schema.round.id, input.id))
        .returning({workspaceId: schema.round.workspaceId});
      invariant(result);
      const {workspaceId} = result;

      // Deferred: Broadcast notification and sync discord
      waitUntil(
        (async () => {
          await Promise.allSettled([
            context.notification.broadcast(workspaceId, {type: "invalidate"}),
            context.discord.sync(workspaceId),
          ]);
        })()
      );
    }),

  delete: procedure.input(z.string()).handler(async ({context, input}) => {
    const round = await db.query.round.findFirst({where: (t, {eq}) => eq(t.id, input)});
    if (!round) throw new ORPCError("NOT_FOUND");
    await context.activityLog.createRound({
      subType: "delete",
      workspaceId: round.workspaceId,
      roundId: round.id,
      roundName: round.name,
    });

    // Delete round from database
    await db.delete(schema.round).where(eq(schema.round.id, input));

    // Deferred: Broadcast notification and sync discord
    waitUntil(
      Promise.all([
        context.notification.broadcast(round.workspaceId, {type: "invalidate"}),
        context.discord.sync(round.workspaceId),
      ])
    );
  }),

  assignUnassignedPuzzles: procedure
    .input(z.object({workspaceSlug: z.string(), parentPuzzleId: z.string()}))
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const parentPuzzle = await db.query.puzzle.findFirst({
        where: (t, {eq}) => eq(t.id, input.parentPuzzleId),
      });
      if (!parentPuzzle) throw new ORPCError("NOT_FOUND");
      await db
        .update(schema.puzzle)
        .set({parentPuzzleId: parentPuzzle.id})
        .where(
          and(
            eq(schema.puzzle.roundId, parentPuzzle.roundId),
            isNull(schema.puzzle.parentPuzzleId),
            eq(schema.puzzle.isMetaPuzzle, false)
          )
        );
      // Deferred: Broadcast notification and sync discord
      waitUntil(
        (async () => {
          await Promise.allSettled([
            context.notification.broadcast(context.workspace.id, {type: "invalidate"}),
            context.discord.sync(context.workspace.id),
          ]);
        })()
      );
    }),
};
