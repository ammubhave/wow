import {onError, ORPCError} from "@orpc/server";
import {RPCHandler} from "@orpc/server/fetch";
import {createFileRoute} from "@tanstack/react-router";

import {captureServerException} from "@/server/posthog";
import {router} from "@/server/router";

const handler = new RPCHandler(router, {
  interceptors: [
    onError((error, {request}) => {
      console.error(error);
      // Expected failures (not signed in, not found, bad input) aren't bugs.
      if (error instanceof ORPCError && error.code !== "INTERNAL_SERVER_ERROR") return;
      captureServerException(error, {properties: {path: new URL(request.url).pathname}});
    }),
  ],
});

export const Route = createFileRoute("/api/rpc/$")({
  server: {
    handlers: {
      ANY: async ({request}) => {
        const {response} = await handler.handle(request, {
          prefix: "/api/rpc",
          context: {headers: request.headers},
        });
        return response ?? new Response(null, {status: 404});
      },
    },
  },
});
