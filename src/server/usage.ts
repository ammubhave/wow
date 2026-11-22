import {env} from "cloudflare:workers";

/**
 * Counts one API call or socket connection for a workspace, for attributing running costs to
 * teams. Written to Workers Analytics Engine (the `wow_usage` dataset): free at this volume and no
 * outbound request, unlike sending a PostHog event per request.
 *
 * Fields: index1 = workspace id; blob1 = workspace id, blob2 = user id, blob3 = kind ("rpc",
 * "socket", "file"), blob4 = name (the procedure or path). Query with the SQL API, for example
 * requests per workspace over the last day:
 *
 *   SELECT blob1 AS workspace, SUM(_sample_interval) AS requests FROM wow_usage
 *   WHERE timestamp > NOW() - INTERVAL '1' DAY GROUP BY workspace ORDER BY requests DESC
 */
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
  env.USAGE.writeDataPoint({indexes: [workspaceId], blobs: [workspaceId, userId, kind, name]});
}
