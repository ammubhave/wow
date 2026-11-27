import {ORPCError} from "@orpc/server";
import {waitUntil} from "cloudflare:workers";
import {and, eq} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {invalidateWorkspace} from "../do/workspace";
import type {FavoriteNotification} from "../notifications";
import {isPuzzleInWorkspace} from "../workspace-access";
import {preauthorize, procedure} from "./base";
import type {NotificationService} from "./services/notification";

export const GUESS_STATUSES = [
  "queued",
  "submitted",
  "correct",
  "incorrect",
  "partial",
  "withdrawn",
] as const;

/**
 * The guess queue: answers the team means to call in, so a hunt's rate limits and backoffs don't
 * lose them, and so nobody calls in what's already been tried. Everyone sees it live (it's in the
 * workspace room's state).
 */
export const guessesRouter = {
  /** Queues a guess for a puzzle. */
  add: procedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        puzzleId: z.string(),
        answer: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .transform(v => v.toUpperCase()),
      })
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      if (!(await isPuzzleInWorkspace(input.puzzleId, context.workspace.id))) {
        throw new ORPCError("NOT_FOUND");
      }
      await db
        .insert(schema.puzzleGuess)
        .values({
          workspaceId: context.workspace.id,
          puzzleId: input.puzzleId,
          answer: input.answer,
          createdBy: context.session.user.id,
        });
      await invalidateWorkspace(context.workspace.id);
      waitUntil(
        notifyStarred(context, input.puzzleId, {kind: "guessQueued", answer: input.answer})
      );
    }),

  /** Moves a guess along: submitted, the hunt's verdict, a backoff (retryAt), or a note. */
  update: procedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        id: z.string(),
        status: z.enum(GUESS_STATUSES).optional(),
        response: z.string().max(500).nullable().optional(),
        /** ms since epoch; null clears it. */
        retryAt: z.number().nullable().optional(),
      })
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const [updated] = await db
        .update(schema.puzzleGuess)
        .set({
          status: input.status,
          response: input.response,
          retryAt:
            input.retryAt === undefined
              ? undefined
              : input.retryAt === null
                ? null
                : new Date(input.retryAt),
          updatedBy: context.session.user.id,
        })
        .where(
          and(
            eq(schema.puzzleGuess.id, input.id),
            eq(schema.puzzleGuess.workspaceId, context.workspace.id)
          )
        )
        .returning({
          id: schema.puzzleGuess.id,
          puzzleId: schema.puzzleGuess.puzzleId,
          answer: schema.puzzleGuess.answer,
        });
      if (!updated) throw new ORPCError("NOT_FOUND");
      await invalidateWorkspace(context.workspace.id);
      // A wrong or partial answer is news to whoever starred the puzzle (a correct one solves it,
      // which everyone hears about).
      if (input.status === "incorrect" || input.status === "partial") {
        waitUntil(
          notifyStarred(context, updated.puzzleId, {
            kind: "guessResult",
            answer: updated.answer,
            result: input.status,
          })
        );
      }
    }),
};

/** Tells whoever starred the puzzle about its guess (by the puzzle's current name). */
async function notifyStarred(
  context: {
    workspace: {id: string};
    session: {user: {id: string; name: string}};
    notification: NotificationService;
  },
  puzzleId: string,
  change: FavoriteNotification["change"]
) {
  const puzzle = await db
    .select({name: schema.puzzle.name})
    .from(schema.puzzle)
    .where(eq(schema.puzzle.id, puzzleId))
    .get();
  if (!puzzle) return;
  await context.notification.favorite(context.workspace.id, {
    puzzleId,
    puzzleName: puzzle.name,
    by: {id: context.session.user.id, name: context.session.user.name},
    change,
  });
}
