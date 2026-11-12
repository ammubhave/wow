import {and, eq, inArray, ne, or, sql} from "drizzle-orm";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {procedure} from "./base";

const SOLVED = ["solved", "backsolved"];

export const meRouter = {
  /// Your own numbers across the hunts you're in: time on puzzles, what you helped solve, and who
  /// with. Only workspaces you're still a member of count. The stats are computed in the browser.
  stats: procedure.handler(async ({context}) => {
    const userId = context.session.user.id;
    // Subqueries rather than lists of IDs: D1 allows only 100 bound parameters per query.
    const myWorkspaces = db
      .select({id: schema.member.organizationId})
      .from(schema.member)
      .where(eq(schema.member.userId, userId));
    const myContributions = db
      .select({puzzleId: schema.puzzleContributor.puzzleId})
      .from(schema.puzzleContributor)
      .where(eq(schema.puzzleContributor.userId, userId));
    const myTimedPuzzles = db
      .select({puzzleId: schema.puzzleTime.puzzleId})
      .from(schema.puzzleTime)
      .where(eq(schema.puzzleTime.userId, userId));

    const [workspaces, time, puzzles, contributions, teammates] = await Promise.all([
      db
        .select({
          id: schema.organization.id,
          name: schema.organization.name,
          slug: schema.organization.slug,
          eventName: schema.organization.eventName,
          createdAt: schema.organization.createdAt,
        })
        .from(schema.organization)
        .where(inArray(schema.organization.id, myWorkspaces)),
      // Active time, per puzzle and hour of the day where you were.
      db
        .select({
          puzzleId: schema.puzzleTime.puzzleId,
          workspaceId: schema.puzzleTime.workspaceId,
          localHour: schema.puzzleTime.localHour,
          seconds: sql<number>`cast(sum(${schema.puzzleTime.seconds}) as integer)`,
        })
        .from(schema.puzzleTime)
        .where(
          and(
            eq(schema.puzzleTime.userId, userId),
            inArray(schema.puzzleTime.workspaceId, myWorkspaces)
          )
        )
        .groupBy(
          schema.puzzleTime.puzzleId,
          schema.puzzleTime.workspaceId,
          schema.puzzleTime.localHour
        ),
      // The puzzles you spent time on or helped solve.
      db
        .select({
          id: schema.puzzle.id,
          name: schema.puzzle.name,
          status: schema.puzzle.status,
          isMetaPuzzle: schema.puzzle.isMetaPuzzle,
          tags: schema.puzzle.tags,
          workspaceId: schema.round.workspaceId,
        })
        .from(schema.puzzle)
        .innerJoin(schema.round, eq(schema.round.id, schema.puzzle.roundId))
        .where(
          and(
            inArray(schema.round.workspaceId, myWorkspaces),
            or(
              inArray(schema.puzzle.id, myContributions),
              inArray(schema.puzzle.id, myTimedPuzzles)
            )
          )
        ),
      myContributions,
      // Who else says they helped solve the solved puzzles you helped solve.
      db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          image: schema.user.image,
          puzzles: sql<number>`cast(count(distinct ${schema.puzzleContributor.puzzleId}) as integer)`,
        })
        .from(schema.puzzleContributor)
        .innerJoin(schema.user, eq(schema.user.id, schema.puzzleContributor.userId))
        .innerJoin(schema.puzzle, eq(schema.puzzle.id, schema.puzzleContributor.puzzleId))
        .innerJoin(schema.round, eq(schema.round.id, schema.puzzle.roundId))
        .where(
          and(
            ne(schema.puzzleContributor.userId, userId),
            inArray(schema.puzzleContributor.puzzleId, myContributions),
            inArray(schema.puzzle.status, SOLVED),
            inArray(schema.round.workspaceId, myWorkspaces)
          )
        )
        .groupBy(schema.user.id)
        .orderBy(sql`count(distinct ${schema.puzzleContributor.puzzleId}) desc`)
        .limit(8),
    ]);

    return {
      workspaces: workspaces.map(({createdAt, ...w}) =>
        Object.assign(w, {createdAt: createdAt.getTime()})
      ),
      time,
      puzzles,
      helped: contributions.map(c => c.puzzleId),
      teammates,
    };
  }),
};
