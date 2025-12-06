import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

export const Route = createFileRoute("/api/notification/$workspaceId")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceId}}) => {
        return await env.NOTIFICATION_ROOMS.getByName(workspaceId, {locationHint: "enam"}).fetch(
          request
        );
      },
    },
  },
});
