import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";
import {z} from "zod";

import type {KvEntry} from "@/server/do/kv-migration";

/**
 * For `scripts/kv-migration.mjs` (see src/server/do/kv-migration.ts): backs up, copies and checks
 * the old key-value Durable Objects, a batch of names at a time. Only with the KV_MIGRATION_TOKEN
 * secret (and not at all without one); delete it, and this route, once the old classes are gone.
 */
const requestSchema = z.object({
  kind: z.enum(["chat", "notification", "discord", "workspace"]),
  action: z.enum(["export", "copy", "status"]),
  names: z.string().min(1).array().max(50),
});

/** Each kind's old and new namespaces, opened the way the app opens them. */
const rooms = {
  chat: {
    legacy: () => env.CHAT_ROOMS_KV,
    current: (name: string) => env.CHAT_ROOMS.getByName(name, {locationHint: "enam"}),
  },
  notification: {
    legacy: () => env.NOTIFICATION_ROOMS_KV,
    current: (name: string) => env.NOTIFICATION_ROOMS.getByName(name, {locationHint: "enam"}),
  },
  discord: {
    legacy: () => env.DISCORD_CLIENT_KV,
    current: (name: string) => env.DISCORD_CLIENT.getByName(name),
  },
  workspace: {
    legacy: () => env.WORKSPACE_ROOMS_KV,
    current: (name: string) => env.WORKSPACE_ROOMS.getByName(name),
  },
};

async function exportAll(
  namespace: ReturnType<(typeof rooms)[keyof typeof rooms]["legacy"]>,
  name: string
) {
  const source = namespace.getByName(name);
  const entries: KvEntry[] = [];
  let alarm: number | null = null;
  let startAfter: string | null = null;
  do {
    // oxlint-disable-next-line no-await-in-loop -- each page starts where the last one ended
    const page = await source.exportPage(startAfter);
    if (startAfter === null) alarm = page.alarm;
    entries.push(...page.entries);
    startAfter = page.next;
  } while (startAfter !== null);
  return {entries, alarm};
}

export const Route = createFileRoute("/api/admin/kv-migration")({
  server: {
    handlers: {
      POST: async ({request}) => {
        const token = process.env.KV_MIGRATION_TOKEN;
        if (!token || request.headers.get("Authorization") !== `Bearer ${token}`) {
          return new Response("Not found", {status: 404});
        }
        const {kind, action, names} = requestSchema.parse(await request.json());
        const room = rooms[kind];
        const results = await Promise.all(
          names.map(async name => {
            if (action === "export")
              return Object.assign({name}, await exportAll(room.legacy(), name));
            if (action === "copy")
              return Object.assign({name}, await room.current(name).copyFromKv(name));
            const {entries} = await exportAll(room.legacy(), name);
            const status = await room.current(name).kvMigrationStatus();
            return Object.assign({name, legacy: entries.length}, status);
          })
        );
        return Response.json(results);
      },
    },
  },
});
