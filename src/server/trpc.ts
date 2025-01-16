import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { initTRPC } from "@trpc/server";
import {
  enhance,
  type PrismaClient as EnhancedPrismaClient,
} from "@zenstackhq/runtime";
import { ExecutionContext } from "hono";
import { z } from "zod";

import { ActivityLogService } from "./services/activity-log";
import { DiscordService } from "./services/discord";
import { GoogleService } from "./services/google";
import { NotificationService } from "./services/notification";
import { UserService } from "./services/user";

export const createContext = async ({
  req,
  env,
  executionContext,
}: {
  req: Request;
  env: Env;
  executionContext: ExecutionContext;
}) => {
  const ctx = {} as unknown as Context;

  // prisma
  const libsql = createClient({
    url: env.TURSO_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  const prisma = new PrismaClient({ adapter });
  ctx.prisma = prisma;

  // user
  const jwt = z.string().parse(req.headers.get("authorization")).slice(7);
  const user = await UserService.create(ctx, jwt);

  // db
  const db = enhance(prisma, { user: { id: user.id } });

  ctx.env = env;
  ctx.waitUntil = (promise: Promise<unknown> | (() => Promise<unknown>)) =>
    typeof promise === "function"
      ? executionContext.waitUntil(promise())
      : executionContext.waitUntil(promise);
  ctx.db = db;
  ctx.user = user;
  ctx.google = new GoogleService(ctx);
  ctx.discord = new DiscordService(ctx);
  ctx.notification = new NotificationService(ctx);
  ctx.activityLog = new ActivityLogService(ctx);
  return ctx;
};

export type Context = {
  env: Env;
  waitUntil: (promise: Promise<unknown> | (() => Promise<unknown>)) => void;
  prisma: PrismaClient;
  db: EnhancedPrismaClient;
  user: UserService;
  google: GoogleService;
  discord: DiscordService;
  notification: NotificationService;
  activityLog: ActivityLogService;
};

const t = initTRPC.context<Context>().create();
export const router = t.router;
export const procedure = t.procedure;
