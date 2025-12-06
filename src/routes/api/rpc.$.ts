import {onError} from "@orpc/server";
import {RPCHandler} from "@orpc/server/fetch";
import {createFileRoute} from "@tanstack/react-router";

import {router} from "@/server/router";

const handler = new RPCHandler(router, {
  interceptors: [
    onError(error => {
      console.error(error);
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
