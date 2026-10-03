import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {NOTIFICATION_USER_HEADER} from "@/server/do/notification";
import {authorizeWorkspaceRequest, requireWebSocketUpgrade} from "@/server/workspace-access";

export const Route = createFileRoute("/api/notification/$workspaceSlug")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceSlug}}) => {
        const notUpgrade = requireWebSocketUpgrade(request);
        if (notUpgrade) return notUpgrade;
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
        if (authz.response) return authz.response;
        // The room keeps each person's read state, so it needs to know who this socket is.
        const headers = new Headers(request.headers);
        headers.set(NOTIFICATION_USER_HEADER, authz.session.user.id);
        return await env.NOTIFICATION_ROOMS.getByName(authz.workspace.id, {
          locationHint: "enam",
        }).fetch(new Request(request, {headers}));
      },
    },
  },
});
