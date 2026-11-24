import {env} from "cloudflare:workers";

/**
 * Usage metering: everything that drives the Cloudflare bill, by workspace, in Workers Analytics
 * Engine (the `wow_usage` dataset). This is the source of truth for attributing running costs to
 * workspaces.
 *
 * Two sources write here:
 * - the app, as things happen: Worker requests, R2 operations and bytes, voice streams;
 * - an hourly import of Cloudflare's own numbers: each workspace's Durable Objects, and account
 *   totals for what Cloudflare doesn't split per workspace (Worker CPU time, D1, R2, storage, voice
 *   egress), see src/server/usage-import.ts. Those totals are split between workspaces by their
 *   share of the app-measured meters (requests, R2 operations, voice streams).
 *
 * One data point is one reading of one meter:
 * - index1 = workspace id ("" when it belongs to no workspace: an account total, a deleted room)
 * - blob1 = workspace id, blob2 = meter, blob3 = detail (what, within the meter), blob4 = user id
 *   (who caused it, when known), blob5 = hour (imported readings: the UTC hour they cover,
 *   "2026-11-23T14:00:00Z")
 * - double1 = quantity, in the meter's unit (some meters have more quantities, in double2 on)
 *
 * Imported readings of a quantity that's a level rather than a count (`*_stored_bytes`) are the
 * hour's peak; average them over the hours of a month for GB-months.
 *
 * Totals per workspace and meter over the last 30 days:
 *
 *   SELECT blob1 AS workspace, blob2 AS meter, SUM(_sample_interval * double1) AS quantity
 *   FROM wow_usage WHERE timestamp > NOW() - INTERVAL '30' DAY
 *   GROUP BY workspace, meter ORDER BY workspace, meter
 */
export type Meter =
  // App-measured
  /** Worker requests (API calls, socket connections, file reads/writes); detail: kind and route. */
  | "worker_requests"
  /** R2 Class A operations (writes); detail: area. */
  | "r2_class_a_ops"
  /** R2 Class B operations (reads, heads); detail: area. */
  | "r2_class_b_ops"
  /** Bytes added to R2; detail: area. */
  | "r2_bytes_added"
  /** Seconds of media streams the SFU delivered; detail: "audio", "camera" or "screen". */
  | "sfu_stream_seconds"
  // Imported from Cloudflare each hour (see usage-import.ts)
  /**
   * A workspace's Durable Objects over the hour (workspace "": objects of no workspace): double1 =
   * billed duration in GB-seconds (active time × 128 MB), double2 = requests, double3 = inbound
   * websocket messages (billed as requests at 20:1), double4 = SQLite rows read, double5 = rows
   * written.
   */
  | "do_hourly"
  // Account totals for the hour (workspace ""), for what Cloudflare doesn't split per workspace
  | "do_stored_bytes"
  | "worker_requests_total"
  | "worker_cpu_ms"
  | "d1_rows_read"
  | "d1_rows_written"
  | "d1_stored_bytes"
  | "r2_class_a_ops_total"
  | "r2_class_b_ops_total"
  | "r2_stored_bytes"
  | "sfu_egress_bytes"
  | "turn_egress_bytes";

export type Reading = {
  workspaceId: string | null;
  meter: Meter;
  quantity: number;
  detail?: string;
  userId?: string;
  hour?: string;
  /** More quantities, after `quantity` (see the meter). */
  doubles?: number[];
};

export function meter(reading: Reading) {
  const {workspaceId, quantity, detail, userId, hour, doubles = []} = reading;
  env.USAGE.writeDataPoint({
    indexes: [workspaceId ?? ""],
    blobs: [workspaceId ?? "", reading.meter, detail ?? "", userId ?? "", hour ?? ""],
    doubles: [quantity, ...doubles],
  });
}

/** One Worker request by a workspace member: an API call, socket connection or file transfer. */
export function recordRequest({
  workspaceId,
  userId,
  kind,
  name,
}: {
  workspaceId: string;
  userId: string;
  kind: string;
  name: string;
}) {
  meter({workspaceId, meter: "worker_requests", quantity: 1, detail: `${kind} ${name}`, userId});
}
