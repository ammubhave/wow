import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {authorizeWorkspaceRequest, requireWebSocketUpgrade} from "@/server/workspace-access";

export const Route = createFileRoute("/api/notification/$workspaceSlug")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceSlug}}) => {
        const notUpgrade = requireWebSocketUpgrade(request);
        if (notUpgrade) return notUpgrade;
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
        if (authz.response) return authz.response;
        return await env.NOTIFICATION_ROOMS.getByName(authz.workspace.id, {
          locationHint: "enam",
        }).fetch(request);
      },
    },
  },
});
