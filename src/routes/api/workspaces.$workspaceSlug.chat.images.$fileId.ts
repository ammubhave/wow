import {createFileRoute} from "@tanstack/react-router";

import {serveImage, storeImage} from "@/server/puzzle-files";
import {authorizeWorkspaceRequest} from "@/server/workspace-access";

// Images shared in the team chat, by the SHA-256 of their bytes.
const key = (workspaceId: string, fileId: string) => `chats/team-${workspaceId}/${fileId}`;

export const Route = createFileRoute("/api/workspaces/$workspaceSlug/chat/images/$fileId")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceSlug, fileId}}) => {
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
        if (authz.response) return authz.response;
        return await serveImage(key(authz.workspace.id, fileId));
      },
      PUT: async ({request, params: {workspaceSlug, fileId}}) => {
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
        if (authz.response) return authz.response;
        return await storeImage(request, key(authz.workspace.id, fileId), {
          fileId,
          verifySha256: true,
        });
      },
    },
  },
});
