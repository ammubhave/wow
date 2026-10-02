import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";

import {auth} from "@/lib/auth";
import {isPuzzleMember} from "@/server/workspace-access";

// Images pasted onto a puzzle's whiteboard, stored in R2 by Excalidraw's file id (a content hash,
// so a file never changes once uploaded).
const MAX_BYTES = 5 * 1024 * 1024;
const key = (puzzleId: string, fileId: string) => `whiteboards/${puzzleId}/${fileId}`;

async function authorize(request: Request, puzzleId: string) {
  const session = await auth.api.getSession({headers: request.headers});
  if (!session) return new Response(null, {status: 401});
  if (!(await isPuzzleMember(puzzleId, session.user.id))) return new Response(null, {status: 404});
  return null;
}

export const Route = createFileRoute("/api/whiteboard/$puzzleId/files/$fileId")({
  server: {
    handlers: {
      GET: async ({request, params: {puzzleId, fileId}}) => {
        const denied = await authorize(request, puzzleId);
        if (denied) return denied;
        const object = await env.R2.get(key(puzzleId, fileId));
        if (object === null) return new Response(null, {status: 404});
        return new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
            // Ids are content hashes: the browser can keep it forever (one R2 read per viewer).
            "Cache-Control": "private, max-age=31536000, immutable",
          },
        });
      },
      PUT: async ({request, params: {puzzleId, fileId}}) => {
        const denied = await authorize(request, puzzleId);
        if (denied) return denied;
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.startsWith("image/")) return new Response(null, {status: 415});
        const body = await request.arrayBuffer();
        if (body.byteLength > MAX_BYTES) return new Response(null, {status: 413});
        // Content-addressed: if it's already there, skip the write.
        if ((await env.R2.head(key(puzzleId, fileId))) === null) {
          await env.R2.put(key(puzzleId, fileId), body, {httpMetadata: {contentType}});
        }
        return new Response(null, {status: 204});
      },
    },
  },
});
