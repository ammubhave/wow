import {ORPCError} from "@orpc/client";
import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {auth} from "@/lib/auth";

export const Route = createFileRoute("/api/notification/$workspaceSlug")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceSlug}}) => {
        const workspace = await auth.api.getFullOrganization({
          headers: request.headers,
          query: {organizationSlug: workspaceSlug},
        });
        if (!workspace) throw new ORPCError("NOT_FOUND");
        return await env.NOTIFICATION_ROOMS.getByName(workspace.id, {locationHint: "enam"}).fetch(
          request
        );
      },
    },
  },
});
