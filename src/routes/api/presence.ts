import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {
  authorizeWorkspaceRequest,
  isPuzzleInWorkspace,
  requireWebSocketUpgrade,
} from "@/server/workspace-access";

export const Route = createFileRoute("/api/presence")({
  server: {
    handlers: {
      GET: async ({request}) => {
        const notUpgrade = requireWebSocketUpgrade(request);
        if (notUpgrade) return notUpgrade;
        const url = new URL(request.url);
        const workspaceSlug = url.searchParams.get("workspaceSlug");
        if (!workspaceSlug) return new Response(null, {status: 400});
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
        if (authz.response) return authz.response;
        const puzzleId = url.searchParams.get("puzzleId");
        if (puzzleId !== null && !(await isPuzzleInWorkspace(puzzleId, authz.workspace.id))) {
          return new Response(null, {status: 404});
        }
        // Keyed by slug (unchanged), but only members of that workspace can join it.
        return await env.PRESENCE_ROOMS.getByName(workspaceSlug, {locationHint: "enam"}).fetch(
          request
        );
      },
    },
  },
});
