import {createORPCClient} from "@orpc/client";
import {RPCLink} from "@orpc/client/fetch";
import {type RouterClient} from "@orpc/server";
import {createTanstackQueryUtils} from "@orpc/tanstack-query";

import {router} from "@/server/router";

/**
 * This is part of the Optimize SSR setup.
 *
 * @see {@link https://orpc.unnoq.com/docs/adapters/tanstack-start#optimize-ssr}
 */
const getORPCClient = (): RouterClient<typeof router> => {
  const link = new RPCLink({url: `${window.location.origin}/api/rpc`});

  return createORPCClient(link);
};

export const client: RouterClient<typeof router> = getORPCClient();

export const orpc = createTanstackQueryUtils(client);
