import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";
import {z} from "zod";

/**
 * Temporary, for a script run once: opens each workspace's notification and workspace
 * rooms (which moves what they kept with key-value calls into their tables, on starting) and
 * reports what they hold. Only with the STORAGE_MOVE_TOKEN secret. Delete with the move code.
 */
const requestSchema = z.object({workspaceIds: z.string().min(1).array().max(50)});

export const Route = createFileRoute("/api/admin/storage-move")({
  server: {
    handlers: {
      POST: async ({request}) => {
        const token = process.env.STORAGE_MOVE_TOKEN;
        if (!token || request.headers.get("Authorization") !== `Bearer ${token}`) {
          return new Response("Not found", {status: 404});
        }
        const {workspaceIds} = requestSchema.parse(await request.json());
        const results = await Promise.all(
          workspaceIds.map(async id => ({
            id,
            notification: await env.NOTIFICATION_ROOMS.getByName(id, {
              locationHint: "enam",
            }).storageReport(),
            workspace: await env.WORKSPACE_ROOMS.getByName(id).storageReport(),
          }))
        );
        return Response.json(results);
      },
    },
  },
});
