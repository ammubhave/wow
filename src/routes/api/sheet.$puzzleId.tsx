import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {webSocketRoute} from "@/server/websocket-route";
import {
  getRequestSession,
  puzzleRoomAccess,
  roomRequest,
  trackWorkspaceRequest,
} from "@/server/workspace-access";

export const Route = createFileRoute("/api/sheet/$puzzleId")({
  server: {
    handlers: {
      GET: ({request, params: {puzzleId}}) =>
        webSocketRoute(request, async () => {
          const session = await getRequestSession(request);
          if (!session) return new Response(null, {status: 401});
          // Only members of the workspace owning this puzzle may see or edit its spreadsheet.
          const access = await puzzleRoomAccess(puzzleId, session.user.id);
          if (!access) {
            return new Response(null, {status: 404});
          }
          trackWorkspaceRequest(request, {
            workspaceId: access.workspaceId,
            userId: session.user.id,
          });
          return await env.SHEET_ROOMS.getByName(puzzleId, {locationHint: "enam"}).fetch(
            roomRequest(request, access)
          );
        }),
    },
  },
});
