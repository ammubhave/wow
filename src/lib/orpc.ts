import {createORPCClient} from "@orpc/client";
import {RPCLink} from "@orpc/client/fetch";
import type {RouterClient} from "@orpc/server";
import {createTanstackQueryUtils} from "@orpc/tanstack-query";

import type {router} from "@/server/router";

// The app is a pure SPA: every RPC goes from the browser to /api/rpc. (There's no server rendering,
// so no server-side client that calls the router directly.)
export const client: RouterClient<typeof router> = createORPCClient(new RPCLink({url: "/api/rpc"}));

export const orpc = createTanstackQueryUtils(client);
