import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {NOTIFICATION_USER_HEADER} from "@/server/do/notification";
import {webSocketRoute} from "@/server/websocket-route";
import {authorizeWorkspaceRequest} from "@/server/workspace-access";

export const Route = createFileRoute("/api/notification/$workspaceSlug")({
  server: {
    handlers: {
      GET: ({request, params: {workspaceSlug}}) =>
        webSocketRoute(request, async () => {
          const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
          if (authz.response) return authz.response;
          // The room keeps each person's read state, so it needs to know who this socket is.
          const headers = new Headers(request.headers);
          headers.set(NOTIFICATION_USER_HEADER, authz.session.user.id);
          return await env.NOTIFICATION_ROOMS.getByName(authz.workspace.id, {
            locationHint: "enam",
          }).fetch(new Request(request, {headers}));
        }),
    },
  },
});
