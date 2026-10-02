import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {auth} from "@/lib/auth";
import {isPuzzleMember, requireWebSocketUpgrade} from "@/server/workspace-access";

export const Route = createFileRoute("/api/whiteboard/$puzzleId")({
  server: {
    handlers: {
      GET: async ({request, params: {puzzleId}}) => {
        const notUpgrade = requireWebSocketUpgrade(request);
        if (notUpgrade) return notUpgrade;
        const session = await auth.api.getSession({headers: request.headers});
        if (!session) return new Response(null, {status: 401});
        // Only members of the workspace owning this puzzle may see or draw on its whiteboard.
        if (!(await isPuzzleMember(puzzleId, session.user.id))) {
          return new Response(null, {status: 404});
        }
        return await env.WHITEBOARD_ROOMS.getByName(puzzleId, {locationHint: "enam"}).fetch(
          request
        );
      },
    },
  },
});
