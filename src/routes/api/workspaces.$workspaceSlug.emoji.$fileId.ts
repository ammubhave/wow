import {createFileRoute} from "@tanstack/react-router";

import {serveImage, storeImage} from "@/server/puzzle-files";
import {authorizeWorkspaceRequest} from "@/server/workspace-access";

// A team's custom reaction emoji, by the SHA-256 of their bytes. Small images only.
const MAX_EMOJI_BYTES = 256 * 1024;
const key = (workspaceId: string, fileId: string) => `emoji/${workspaceId}/${fileId}`;

export const Route = createFileRoute("/api/workspaces/$workspaceSlug/emoji/$fileId")({
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
          maxBytes: MAX_EMOJI_BYTES,
        });
      },
    },
  },
});
