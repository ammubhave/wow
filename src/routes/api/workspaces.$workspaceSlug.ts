import {createFileRoute} from "@tanstack/react-router";

import {getWorkspaceRoom, WORKSPACE_USER_HEADER} from "@/server/do/workspace";
import type {VoiceUser} from "@/server/voice";
import {authorizeWorkspaceRequest, requireWebSocketUpgrade} from "@/server/workspace-access";

export const Route = createFileRoute("/api/workspaces/$workspaceSlug")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceSlug}}) => {
        const notUpgrade = requireWebSocketUpgrade(request);
        if (notUpgrade) return notUpgrade;
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
        if (authz.response) return authz.response;
        const room = getWorkspaceRoom(authz.workspace.id);
        await room.initialize(authz.workspace.id);
        // The room shows who's in which voice call, so it needs to know who this socket is.
        const {id, name, email, image} = authz.session.user;
        const user: VoiceUser = {id, name, email, image: image ?? null};
        const headers = new Headers(request.headers);
        headers.set(WORKSPACE_USER_HEADER, JSON.stringify(user));
        return await room.fetch(new Request(request, {headers}));
      },
    },
  },
});
