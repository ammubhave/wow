import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {TEAM_CHAT_WORKSPACE_HEADER, teamChatRoomName} from "@/server/do/chat";
import {authorizeWorkspaceRequest, requireWebSocketUpgrade} from "@/server/workspace-access";

// The team chat (on the blackboard): one room per workspace, for its members only.
export const Route = createFileRoute("/api/workspaces/$workspaceSlug/chat")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceSlug}}) => {
        const notUpgrade = requireWebSocketUpgrade(request);
        if (notUpgrade) return notUpgrade;
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
        if (authz.response) return authz.response;
        // The room learns its workspace from us, never from the browser.
        const headers = new Headers(request.headers);
        headers.set(TEAM_CHAT_WORKSPACE_HEADER, authz.workspace.id);
        return await env.CHAT_ROOMS.getByName(teamChatRoomName(authz.workspace.id), {
          locationHint: "enam",
        }).fetch(new Request(request, {headers}));
      },
    },
  },
});
