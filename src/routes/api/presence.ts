import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";
import z from "zod";

export const Route = createFileRoute("/api/presence")({
  server: {
    handlers: {
      GET: async ({request}) => {
        const url = new URL(request.url);
        const workspaceSlug = z.string().parse(url.searchParams.get("workspaceSlug"));
        return await env.PRESENCE_ROOMS.getByName(workspaceSlug, {locationHint: "enam"}).fetch(
          request
        );
      },
    },
  },
});
