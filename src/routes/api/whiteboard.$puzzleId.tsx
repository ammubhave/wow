import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {webSocketRoute} from "@/server/websocket-route";
import {getRequestSession, isPuzzleMember} from "@/server/workspace-access";

export const Route = createFileRoute("/api/whiteboard/$puzzleId")({
  server: {
    handlers: {
      GET: ({request, params: {puzzleId}}) =>
        webSocketRoute(request, async () => {
          const session = await getRequestSession(request);
          if (!session) return new Response(null, {status: 401});
          // Only members of the workspace owning this puzzle may see or draw on its whiteboard.
          if (!(await isPuzzleMember(puzzleId, session.user.id))) {
            return new Response(null, {status: 404});
          }
          return await env.WHITEBOARD_ROOMS.getByName(puzzleId, {locationHint: "enam"}).fetch(
            request
          );
        }),
    },
  },
});
