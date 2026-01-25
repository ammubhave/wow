import {ORPCError} from "@orpc/client";
import {createFileRoute} from "@tanstack/react-router";

import {auth} from "@/lib/auth";
import {getWorkspaceRoom} from "@/server/do/workspace";

export const Route = createFileRoute("/api/workspaces/$workspaceSlug")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceSlug}}) => {
        const workspace = await auth.api.getFullOrganization({
          headers: request.headers,
          query: {organizationSlug: workspaceSlug},
        });
        if (!workspace) throw new ORPCError("NOT_FOUND");
        return await (await getWorkspaceRoom(workspace.id)).fetch(request);
      },
    },
  },
});
