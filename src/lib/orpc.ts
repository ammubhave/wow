import {createORPCClient} from "@orpc/client";
import {RPCLink} from "@orpc/client/fetch";
import {createRouterClient, type RouterClient} from "@orpc/server";
import {createTanstackQueryUtils} from "@orpc/tanstack-query";
import {createIsomorphicFn} from "@tanstack/react-start";
import {getRequestHeaders} from "@tanstack/react-start/server";

import {router} from "@/server/router";

/**
 * This is part of the Optimize SSR setup.
 *
 * @see {@link https://orpc.unnoq.com/docs/adapters/tanstack-start#optimize-ssr}
 */
const getORPCClient = createIsomorphicFn()
  .server(() => createRouterClient(router, {context: async () => ({headers: getRequestHeaders()})}))
  .client((): RouterClient<typeof router> => {
    const link = new RPCLink({url: `${window.location.origin}/api/rpc`});

    return createORPCClient(link);
  });

export const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
