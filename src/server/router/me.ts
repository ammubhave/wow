import {and, count, eq, inArray, ne, or, sql} from "drizzle-orm";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {toWorkspaceRole} from "../workspace-access";
import {procedure} from "./base";

const SOLVED = ["solved", "backsolved"];

export const meRouter = {
  /// The workspaces you're in, for the workspace list: your role, the hunt's dates, how many are
  /// on the team, and how far the board has got.
  workspaces: procedure.handler(async ({context}) => {
    const userId = context.session.user.id;
    const myWorkspaces = db
      .select({id: schema.member.organizationId})
      .from(schema.member)
      .where(eq(schema.member.userId, userId));
    const [workspaces, puzzles, members] = await Promise.all([
      db
        .select({
          id: schema.organization.id,
          slug: schema.organization.slug,
          teamName: schema.organization.teamName,
          eventName: schema.organization.eventName,
          huntStartsAt: schema.organization.huntStartsAt,
          huntEndsAt: schema.organization.huntEndsAt,
          createdAt: schema.organization.createdAt,
          role: schema.member.role,
        })
        .from(schema.member)
        .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
        .where(eq(schema.member.userId, userId)),
      db
        .select({
          workspaceId: schema.round.workspaceId,
          total: count(schema.puzzle.id),
          solved: sql<number>`cast(sum(case when ${schema.puzzle.status} in ('solved', 'backsolved') then 1 else 0 end) as integer)`,
        })
        .from(schema.puzzle)
        .innerJoin(schema.round, eq(schema.round.id, schema.puzzle.roundId))
        .where(inArray(schema.round.workspaceId, myWorkspaces))
        .groupBy(schema.round.workspaceId),
      db
        .select({workspaceId: schema.member.organizationId, members: count()})
        .from(schema.member)
        .where(inArray(schema.member.organizationId, myWorkspaces))
        .groupBy(schema.member.organizationId),
    ]);
    const puzzlesBy = new Map(puzzles.map(p => [p.workspaceId, p]));
    const membersBy = new Map(members.map(m => [m.workspaceId, m.members]));
    return workspaces.map(w => ({
      slug: w.slug,
      teamName: w.teamName,
      eventName: w.eventName,
      role: toWorkspaceRole(w.role),
      huntStartsAt: w.huntStartsAt?.getTime() ?? null,
      huntEndsAt: w.huntEndsAt?.getTime() ?? null,
      createdAt: w.createdAt.getTime(),
      members: membersBy.get(w.id) ?? 0,
      puzzles: puzzlesBy.get(w.id)?.total ?? 0,
      solved: puzzlesBy.get(w.id)?.solved ?? 0,
    }));
  }),

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
