import {Hono} from "hono";
import {createMiddleware} from "hono/factory";

import {auth} from "@/lib/auth";
import {type HonoEnv} from "@/server/context";

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({headers: c.req.raw.headers});
  if (session) {
    c.set("session", session);
  }
  await next();
});

export const protectedMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.var.session) {
    return c.body(null, 401);
  }
  await next();
});

const app = new Hono<HonoEnv>();

export {app};
