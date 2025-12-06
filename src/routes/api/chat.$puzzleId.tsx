import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

export const Route = createFileRoute("/api/chat/$puzzleId")({
  server: {
    handlers: {
      GET: async ({request, params: {puzzleId}}) => {
        return await env.CHAT_ROOMS.getByName(puzzleId, {locationHint: "enam"}).fetch(request);
      },
    },
  },
});
