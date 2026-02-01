import {ORPCError} from "@orpc/client";
import {env} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {AuthenticatedContext, base, procedure} from "./base";

const preauthorize = base.$context<AuthenticatedContext>().middleware(async ({context, next}) => {
  const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(",") || [];
  console.log("Admin emails:", ADMIN_EMAILS, "User email:", context.session.user.email);
  if (!ADMIN_EMAILS.includes(context.session.user.email)) {
    throw new ORPCError("FORBIDDEN");
  }
  return next();
});

export const exchangeRouter = {
  hunts: {
    list: base.handler(async () => {
      return await db.select().from(schema.hunts);
    }),
    get: base.input(z.object({huntId: z.string().min(1)})).handler(async ({input}) => {
      const hunt = await db.query.hunts.findFirst({
        where: eq(schema.hunts.id, input.huntId),
        with: {hunt_puzzles: true},
      });
      if (!hunt) throw new ORPCError("NOT_FOUND");
      return hunt;
    }),
    create: procedure
      .use(preauthorize)
      .input(z.object({name: z.string().min(1)}))
      .handler(async ({input}) => {
        const [hunt] = await db.insert(schema.hunts).values({name: input.name}).returning();
        if (!hunt) throw new ORPCError("INTERNAL_SERVER_ERROR");
        return hunt;
      }),
  },
  puzzles: {
    get: base.input(z.object({huntPuzzleId: z.string().min(1)})).handler(async ({input}) => {
      const [puzzle] = await db
        .select()
        .from(schema.huntPuzzles)
        .innerJoin(schema.hunts, eq(schema.huntPuzzles.huntId, schema.hunts.id))
        .where(eq(schema.huntPuzzles.id, input.huntPuzzleId));
      if (!puzzle) throw new ORPCError("NOT_FOUND");
      return puzzle;
    }),
    submitAnswer: base
      .input(z.object({huntPuzzleId: z.string().min(1), answer: z.string().min(1)}))
      .handler(async ({input}) => {
        const puzzle = await db.query.huntPuzzles.findFirst({
          where: eq(schema.huntPuzzles.id, input.huntPuzzleId),
        });
        if (!puzzle) throw new ORPCError("NOT_FOUND");
        const isCorrect = input.answer.trim().toLowerCase() === puzzle.answer.trim().toLowerCase();
        const partial = puzzle.partials?.find(
          partial => input.answer.trim().toLowerCase() === partial.answer.trim().toLowerCase()
        );
        return {isCorrect, isPartial: partial !== undefined, message: partial?.message} as
          | {isCorrect: true}
          | {isCorrect: false; isPartial: true; message: string}
          | {isCorrect: false; isPartial: false};
      }),
    update: procedure
      .use(preauthorize)
      .input(
        z.object({
          huntPuzzleId: z.string().min(1),
          title: z.string().min(1),
          contents: z.any().optional(),
          answer: z.string().min(1).toUpperCase(),
          partials: z.array(
            z.object({answer: z.string().min(1).toUpperCase(), message: z.string().min(1)})
          ),
          hints: z
            .array(z.object({title: z.string().min(1), message: z.string().min(1)}))
            .optional(),
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
