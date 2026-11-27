import {Hono} from "hono";
import {createMiddleware} from "hono/factory";

import {type HonoEnv} from "@/server/context";
import {getHeadersSession} from "@/server/request-session";

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await getHeadersSession(c.req.raw.headers);
  if (session) {
    c.set("session", session);
  }
  await next();
});

export const protectedMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  if (!c.var.session) {
    return c.body(null, 401);
  }
  return next();
});

const app = new Hono<HonoEnv>();

export {app};
