import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";
import z from "zod";

export const Route = createFileRoute("/api/presence")({
  server: {
    handlers: {
      GET: async ({request}) => {
        const url = new URL(request.url);
        const workspaceId = z.string().parse(url.searchParams.get("workspaceId"));
        return await env.PRESENCE_ROOMS.getByName(workspaceId, {locationHint: "enam"}).fetch(
          request
        );
      },
    },
  },
});
