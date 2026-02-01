import {ORPCError} from "@orpc/client";
import {getRequestHeaders} from "@tanstack/react-start/server";
import {env} from "cloudflare:workers";
import {and, asc, eq} from "drizzle-orm";
import {v7 as uuidv7} from "uuid";
import {z} from "zod";

import {auth} from "@/lib/auth";
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

const isAdmin = async () => {
  const session = await auth.api.getSession({headers: getRequestHeaders()});
  if (!session) return false;
  return (process.env.ADMIN_EMAILS?.split(",") || []).includes(session.user.email);
};

export const exchangeRouter = {
  isAdmin: base.handler(async () => {
    return await isAdmin();
  }),
  hunts: {
    list: base.handler(async () => {
      const admin = await isAdmin();
      return admin
        ? await db.select().from(schema.hunts).orderBy(asc(schema.hunts.createdAt))
        : await db
            .select()
            .from(schema.hunts)
            .where(eq(schema.hunts.draft, false))
            .orderBy(asc(schema.hunts.createdAt));
    }),
    get: base.input(z.object({huntId: z.string().min(1)})).handler(async ({input}) => {
      const admin = await isAdmin();
      const hunt = await db.query.hunts.findFirst({
        where: admin
          ? eq(schema.hunts.id, input.huntId)
          : and(eq(schema.hunts.id, input.huntId), eq(schema.hunts.draft, false)),
        with: {
          hunt_puzzles: admin
            ? {orderBy: asc(schema.huntPuzzles.title)}
            : {where: eq(schema.huntPuzzles.draft, false), orderBy: asc(schema.huntPuzzles.title)},
        },
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
    get: base.input(z.object({huntPuzzleId: z.string().min(1)})).handler(async ({input}) => {
      const [puzzle] = await db
        .select()
        .from(schema.huntPuzzles)
        .innerJoin(schema.hunts, eq(schema.huntPuzzles.huntId, schema.hunts.id))
        .where(eq(schema.huntPuzzles.id, input.huntPuzzleId));
      if (!puzzle) throw new ORPCError("NOT_FOUND");
      return puzzle;
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
      .handler(async ({input}) => {
        const puzzle = await db.query.huntPuzzles.findFirst({
          where: eq(schema.huntPuzzles.id, input.huntPuzzleId),
        });
        if (!puzzle) throw new ORPCError("NOT_FOUND");
        const isCorrect =
          input.answer.toUpperCase().replace(/[^A-Z]/g, "") ===
          puzzle.answer.toUpperCase().replace(/[^A-Z]/g, "");
        const partial = puzzle.partials?.find(
          partial =>
            input.answer.toUpperCase().replace(/[^A-Z]/g, "") ===
            partial.answer.toUpperCase().replace(/[^A-Z]/g, "")
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
