import {ORPCError, os} from "@orpc/server";
import {env} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {auth} from "@/lib/auth";
import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {base, procedure, type Session} from "./base";

const preauthorize = os.$context<{session: Session}>().middleware(async ({context, next}) => {
  const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(",") || [];
  if (!ADMIN_EMAILS.includes(context.session.user.email)) {
    throw new ORPCError("FORBIDDEN");
  }
  return next();
});

const isAdmin = async (headers: Headers) => {
  const session = await auth.api.getSession({headers});
  if (!session) return false;
  return (process.env.ADMIN_EMAILS?.split(",") || []).includes(session.user.email);
};

type SubmitAnswerResult =
  | {isCorrect: true}
  | {isCorrect: false; isPartial: true; message: string}
  | {isCorrect: false; isPartial: false};

const normalizeAnswer = (answer: string) => answer.toUpperCase().replace(/[^A-Z]/g, "");

export const exchangeRouter = {
  isAdmin: base.handler(async ({context}) => {
    return await isAdmin(context.headers);
  }),
  hunts: {
    // Newest hunt first, each with its puzzles' titles (never answers or contents).
    list: base.handler(async ({context}) => {
      const admin = await isAdmin(context.headers);
      return await db.query.hunts.findMany({
        where: admin ? undefined : {draft: false},
        orderBy: {createdAt: "desc"},
        with: {
          hunt_puzzles: {
            columns: {id: true, title: true, draft: true},
            where: admin ? undefined : {draft: false},
            orderBy: {title: "asc"},
          },
        },
      });
    }),
    get: base.input(z.object({huntId: z.string().min(1)})).handler(async ({context, input}) => {
      const admin = await isAdmin(context.headers);
      const hunt = await db.query.hunts.findFirst({
        where: admin ? {id: input.huntId} : {id: input.huntId, draft: false},
        with: {
          hunt_puzzles: {
            // Only what the list shows: answers and contents stay on the server.
            columns: {id: true, title: true, draft: true, answer: true},
            where: admin ? undefined : {draft: false},
            orderBy: {title: "asc"},
          },
        },
      });
      if (!hunt) throw new ORPCError("NOT_FOUND");
      return {
        ...hunt,
        hunt_puzzles: hunt.hunt_puzzles.map(puzzle => ({
          id: puzzle.id,
          title: puzzle.title,
          draft: puzzle.draft,
          // Admins land on the editor for a puzzle that has no answer yet.
          needsSetup: admin && puzzle.answer === "",
        })),
      };
    }),
    create: procedure
      .use(preauthorize)
      .input(z.object({name: z.string().min(1)}))
      .handler(async ({input}) => {
        const [hunt] = await db.insert(schema.hunts).values({name: input.name}).returning();
        if (!hunt) throw new ORPCError("INTERNAL_SERVER_ERROR");
        return hunt;
      }),
    update: procedure
      .use(preauthorize)
      .input(
        z.object({
          huntId: z.string().min(1),
          name: z.string().min(1).optional(),
          draft: z.boolean().optional(),
        })
      )
      .handler(async ({input}) => {
        const [hunt] = await db
          .update(schema.hunts)
          .set({name: input.name, draft: input.draft})
          .where(eq(schema.hunts.id, input.huntId))
          .returning();
        if (!hunt) throw new ORPCError("NOT_FOUND");
        return hunt;
      }),
  },
  puzzles: {
    get: base
      .input(z.object({huntPuzzleId: z.string().min(1)}))
      .handler(async ({context, input}) => {
        const [puzzle] = await db
          .select()
          .from(schema.huntPuzzles)
          .innerJoin(schema.hunts, eq(schema.huntPuzzles.huntId, schema.hunts.id))
          .where(eq(schema.huntPuzzles.id, input.huntPuzzleId));
        if (!puzzle) throw new ORPCError("NOT_FOUND");
        // Draft puzzles (or puzzles of draft hunts) are only visible to admins, as in `hunts.get`.
        const admin = await isAdmin(context.headers);
        if ((puzzle.hunt_puzzles.draft || puzzle.hunts.draft) && !admin) {
          throw new ORPCError("NOT_FOUND");
        }
        if (admin) return puzzle;
        // Solvers get the puzzle, not its answer: answers are checked by `submitAnswer`, and the
        // solution is fetched separately (`solution`) only when someone asks for it.
        return {
          ...puzzle,
          hunt_puzzles: {...puzzle.hunt_puzzles, answer: "", partials: [], solution: null},
        };
      }),
    solution: base
      .input(z.object({huntPuzzleId: z.string().min(1)}))
      .handler(async ({context, input}) => {
        const [puzzle] = await db
          .select({
            title: schema.huntPuzzles.title,
            answer: schema.huntPuzzles.answer,
            solution: schema.huntPuzzles.solution,
            draft: schema.huntPuzzles.draft,
            hunt: {id: schema.hunts.id, name: schema.hunts.name, draft: schema.hunts.draft},
          })
          .from(schema.huntPuzzles)
          .innerJoin(schema.hunts, eq(schema.huntPuzzles.huntId, schema.hunts.id))
          .where(eq(schema.huntPuzzles.id, input.huntPuzzleId));
        if (!puzzle) throw new ORPCError("NOT_FOUND");
        if ((puzzle.draft || puzzle.hunt.draft) && !(await isAdmin(context.headers))) {
          throw new ORPCError("NOT_FOUND");
        }
        return {
          title: puzzle.title,
          answer: puzzle.answer,
          solution: puzzle.solution,
          hunt: {id: puzzle.hunt.id, name: puzzle.hunt.name},
        };
      }),
    create: procedure
      .use(preauthorize)
      .input(z.object({huntId: z.string().min(1), title: z.string().min(1)}))
      .handler(async ({input}) => {
        const [puzzle] = await db
          .insert(schema.huntPuzzles)
          .values({huntId: input.huntId, title: input.title, answer: ""})
          .returning();
        if (!puzzle) throw new ORPCError("INTERNAL_SERVER_ERROR");
        return puzzle;
      }),
    delete: procedure
      .use(preauthorize)
      .input(z.object({huntPuzzleId: z.string().min(1)}))
      .handler(async ({input}) => {
        await db.delete(schema.huntPuzzles).where(eq(schema.huntPuzzles.id, input.huntPuzzleId));
        return;
      }),
    submitAnswer: base
      .input(z.object({huntPuzzleId: z.string().min(1), answer: z.string().min(1)}))
      .handler(async ({input}): Promise<SubmitAnswerResult> => {
        const puzzle = await db.query.huntPuzzles.findFirst({
          where: {id: input.huntPuzzleId},
          columns: {answer: true, partials: true},
        });
        if (!puzzle) throw new ORPCError("NOT_FOUND");
        const submitted = normalizeAnswer(input.answer);
        if (submitted === normalizeAnswer(puzzle.answer)) return {isCorrect: true};
        const partial = puzzle.partials?.find(p => submitted === normalizeAnswer(p.answer));
        if (partial) return {isCorrect: false, isPartial: true, message: partial.message};
        return {isCorrect: false, isPartial: false};
      }),
    update: procedure
      .use(preauthorize)
      .input(
        z.object({
          huntPuzzleId: z.string().min(1),
          title: z.string().min(1).optional(),
          contents: z.any().optional(),
          answer: z.string().min(1).toUpperCase().optional(),
          partials: z
            .array(z.object({answer: z.string().min(1).toUpperCase(), message: z.string().min(1)}))
            .optional(),
          hints: z
            .array(z.object({title: z.string().min(1), message: z.string().min(1)}))
            .optional(),
          solution: z.any().optional(),
          draft: z.boolean().optional(),
        })
      )
      .handler(async ({input}) => {
        const [puzzle] = await db
          .update(schema.huntPuzzles)
          .set({
            title: input.title,
            contents: input.contents,
            answer: input.answer,
            partials: input.partials,
            hints: input.hints,
            solution: input.solution,
            draft: input.draft,
          })
          .where(eq(schema.huntPuzzles.id, input.huntPuzzleId))
          .returning();
        if (!puzzle) throw new ORPCError("NOT_FOUND");
        return puzzle;
      }),
    assets: {
      upload: procedure
        .use(preauthorize)
        .input(z.object({huntPuzzleId: z.string().min(1), asset: z.file()}))
        .handler(async ({input}) => {
          const id = uuidv7();
          await env.R2.put(`exchange/${input.huntPuzzleId}/${id}`, input.asset.stream(), {
            httpMetadata: {contentType: input.asset.type || "application/octet-stream"},
          });
          return {url: `/api/exchange/puzzles/${input.huntPuzzleId}/assets/${id}`};
        }),
    },
  },
};
