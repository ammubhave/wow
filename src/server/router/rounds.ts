import {ORPCError} from "@orpc/server";
import {waitUntil} from "cloudflare:workers";
import {and, eq, isNull} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {invalidateWorkspace} from "../do/workspace";
import {preauthorize, procedure} from "./base";

export const roundsRouter = {
  list: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}) => {
      const rounds = await db.query.round.findMany({
        where: {workspaceId: context.workspace.id},
        with: {puzzles: {with: {childPuzzles: true}}},
        orderBy: {name: "asc"},
      });
      return rounds.map(round =>
        Object.assign(round, {
          unassignedPuzzles: round.puzzles.filter(
            puzzle => !puzzle.isMetaPuzzle && puzzle.parentPuzzleId === null
          ),
          metaPuzzles: round.puzzles.filter(puzzle => puzzle.isMetaPuzzle),
        })
      );
    }),

  create: procedure
    // `id` is client-generated so the optimistic round and the real one share an id.
    .input(z.object({workspaceSlug: z.string(), id: z.uuid().optional(), name: z.string()}))
    .use(preauthorize)
    .handler(async ({context, input}) => {
      // Create round in database
      const round = await db
        .insert(schema.round)
        .values({id: input.id, workspaceId: context.workspace.id, name: input.name})
        .returning()
        .get();
      await context.activityLog.createRound({
        subType: "create",
        workspaceId: context.workspace.id,
        roundId: round.id,
        roundName: round.name,
      });
      await invalidateWorkspace(context.workspace.id);
      waitUntil(context.discord.sync(context.workspace.id));
      return round;
    }),

  update: procedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        id: z.string(),
        name: z.string().min(1).optional(),
        status: z.string().nullable().optional(),
      })
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      // Update round in database
      const [result] = await db
        .update(schema.round)
        .set({name: input.name, status: input.status})
        .where(
          and(eq(schema.round.id, input.id), eq(schema.round.workspaceId, context.workspace.id))
        )
        .returning({workspaceId: schema.round.workspaceId});
      if (!result) throw new ORPCError("NOT_FOUND");
      const {workspaceId} = result;
      await invalidateWorkspace(workspaceId);
      waitUntil(context.discord.sync(workspaceId));
    }),

  delete: procedure
    .input(z.object({workspaceSlug: z.string(), id: z.string()}))
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const round = await db.query.round.findFirst({
        where: {id: input.id, workspaceId: context.workspace.id},
        columns: {id: true, name: true, workspaceId: true},
      });
      if (!round) throw new ORPCError("NOT_FOUND");
      await context.activityLog.createRound({
        subType: "delete",
        workspaceId: round.workspaceId,
        roundId: round.id,
        roundName: round.name,
      });

      // Delete round from database
      await db.delete(schema.round).where(eq(schema.round.id, input.id));
      await invalidateWorkspace(round.workspaceId);
      waitUntil(context.discord.sync(round.workspaceId));
    }),

  assignUnassignedPuzzles: procedure
    .input(z.object({workspaceSlug: z.string(), parentPuzzleId: z.string()}))
    .use(preauthorize)
    .handler(async ({context, input}) => {
      // Scope to the caller's workspace: the id comes from input.
      const parentPuzzle = await db.query.puzzle.findFirst({
        where: {
          id: input.parentPuzzleId,
          isMetaPuzzle: true,
          round: {workspaceId: context.workspace.id},
        },
        columns: {id: true, roundId: true},
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
      await invalidateWorkspace(context.workspace.id);
      waitUntil(context.discord.sync(context.workspace.id));
    }),
};
