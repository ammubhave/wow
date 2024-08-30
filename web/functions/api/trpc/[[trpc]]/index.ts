import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "../../../../server/index";
import { createContext } from "../../../../server/trpc";

export const onRequest: PagesFunction<Env> = (context) => {
  return fetchRequestHandler({
    req: context.request,
    endpoint: "/api/trpc",
    router: appRouter,
    createContext: ({ req }) =>
      createContext({ req, env: context.env, waitUntil: context.waitUntil }),
  });
};
