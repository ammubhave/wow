import {createFileRoute} from "@tanstack/react-router";

import {getWorkspaceRoom} from "@/server/do/workspace";
import {authorizeWorkspaceRequest, requireWebSocketUpgrade} from "@/server/workspace-access";

export const Route = createFileRoute("/api/workspaces/$workspaceSlug")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceSlug}}) => {
        const notUpgrade = requireWebSocketUpgrade(request);
        if (notUpgrade) return notUpgrade;
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
        if (authz.response) return authz.response;
        const room = getWorkspaceRoom(authz.workspace.id);
        await room.initialize(authz.workspace.id);
        return await room.fetch(request);
      },
    },
  },
});
