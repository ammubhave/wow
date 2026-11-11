import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {auth} from "@/lib/auth";
import {webSocketRoute} from "@/server/websocket-route";
import {isPuzzleMember} from "@/server/workspace-access";

export const Route = createFileRoute("/api/chat/$puzzleId")({
  server: {
    handlers: {
      GET: ({request, params: {puzzleId}}) =>
        webSocketRoute(request, async () => {
          const session = await auth.api.getSession({headers: request.headers});
          if (!session) return new Response(null, {status: 401});
          // Only members of the workspace owning this puzzle may read or post to its chat.
          if (!(await isPuzzleMember(puzzleId, session.user.id))) {
            return new Response(null, {status: 404});
          }
          return await env.CHAT_ROOMS.getByName(puzzleId, {locationHint: "enam"}).fetch(request);
        }),
    },
  },
});
