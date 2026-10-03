import {env} from "cloudflare:workers";

import {auth} from "@/lib/auth";
import {isPuzzleMember} from "@/server/workspace-access";

// Images shared on a puzzle (chat, whiteboard), stored in R2 under `<area>/<puzzleId>/<id>`. Ids
// are content hashes, so a file never changes once uploaded.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const puzzleFilesPrefix = (area: string, puzzleId: string) => `${area}/${puzzleId}/`;

async function authorize(request: Request, puzzleId: string) {
  const session = await auth.api.getSession({headers: request.headers});
  if (!session) return new Response(null, {status: 401});
  if (!(await isPuzzleMember(puzzleId, session.user.id))) return new Response(null, {status: 404});
  return null;
}

async function sha256Hex(body: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", body);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Serves a stored image (content-addressed, so browsers may cache it forever). */
export async function serveImage(key: string) {
  const object = await env.R2.get(key);
  if (object === null) return new Response(null, {status: 404});
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      // Content-addressed: the browser can keep it forever (one R2 read per viewer).
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

/**
 * Stores an uploaded image under `key`. With `verifySha256`, `fileId` must be the SHA-256 of the
 * bytes, so nobody can put different content under an id someone else will send.
 */
export async function storeImage(
  request: Request,
  key: string,
  {
    fileId,
    verifySha256 = false,
    maxBytes = MAX_IMAGE_BYTES,
  }: {fileId: string; verifySha256?: boolean; maxBytes?: number}
) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return new Response(null, {status: 415});
  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) return new Response(null, {status: 413});
  if (verifySha256 && (await sha256Hex(body)) !== fileId) return new Response(null, {status: 400});
  // Already there (same content): skip the write.
  if ((await env.R2.head(key)) === null) {
    await env.R2.put(key, body, {httpMetadata: {contentType}});
  }
  return new Response(null, {status: 204});
}

/** GET/PUT handlers for one area's puzzle images (see `storeImage` for `verifySha256`). */
export function puzzleFileHandlers(area: string, {verifySha256 = false} = {}) {
  type Params = {params: {puzzleId: string; fileId: string}; request: Request};
  return {
    GET: async ({request, params: {puzzleId, fileId}}: Params) => {
      const denied = await authorize(request, puzzleId);
      if (denied) return denied;
      return await serveImage(puzzleFilesPrefix(area, puzzleId) + fileId);
    },
    PUT: async ({request, params: {puzzleId, fileId}}: Params) => {
      const denied = await authorize(request, puzzleId);
      if (denied) return denied;
      return await storeImage(request, puzzleFilesPrefix(area, puzzleId) + fileId, {
        fileId,
        verifySha256,
      });
    },
  };
}

/** Deletes every file under `prefix` (when a puzzle's chat or whiteboard expires). */
export async function deletePuzzleFiles(bucket: R2Bucket, prefix: string, cursor?: string) {
  // Listings are paged (up to 1000 keys), so each page is deleted before fetching the next.
  const listing = await bucket.list({prefix, cursor});
  if (listing.objects.length > 0) await bucket.delete(listing.objects.map(object => object.key));
  if (listing.truncated) await deletePuzzleFiles(bucket, prefix, listing.cursor);
}
