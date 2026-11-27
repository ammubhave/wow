import {createORPCClient} from "@orpc/client";
import {RPCLink} from "@orpc/client/fetch";
import type {RouterClient} from "@orpc/server";
import {createTanstackQueryUtils} from "@orpc/tanstack-query";

import type {router} from "@/server/router";

import {apiAuthHeaders, apiUrl} from "./api-endpoint";

// The app is a pure SPA: every RPC goes from the browser to /api/rpc. (There's no server rendering,
// so no server-side client that calls the router directly.) The Chrome extension calls the same
// API from its own origin, with its access token (see api-endpoint.ts).
export const client: RouterClient<typeof router> = createORPCClient(
  new RPCLink({url: "/api/rpc", origin: () => apiUrl("") || undefined, headers: apiAuthHeaders})
);

export const orpc = createTanstackQueryUtils(client);
