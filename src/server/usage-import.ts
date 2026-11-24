import {env} from "cloudflare:workers";
import {desc, eq, inArray, or} from "drizzle-orm";

import {chunks} from "@/lib/chunks";
import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {type Meter, meter, type Reading} from "./usage";

/**
 * The hourly import of Cloudflare's own usage numbers into the usage dataset (see usage.ts): what
 * each workspace's Durable Objects used, and account totals for everything Cloudflare doesn't split
 * by object (Worker CPU time, D1, R2, storage, voice egress). These come from the GraphQL
 * Analytics API, the same numbers the dashboard shows.
 *
 * Each hour is imported once (recorded in `usage_imports` before its readings are written), oldest
 * first, from the hour after the last one imported up to the hour that ended before this run.
 */

const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
/** How far back the first import starts. */
const FIRST_IMPORT_HOURS = 24;
/** Analytics Engine takes at most 250 data points per Worker invocation. */
const MAX_POINTS = 250;
const HOUR_MS = 60 * 60 * 1000;

/** R2 operations by class (https://developers.cloudflare.com/r2/pricing/); the rest are Class A. */
const R2_CLASS_B = new Set([
  "HeadObject",
  "GetObject",
  "HeadBucket",
  "UsageSummary",
  "GetBucketEncryption",
  "GetBucketLocation",
  "GetBucketCors",
  "GetBucketLifecycleConfiguration",
]);
const R2_FREE = new Set(["DeleteObject", "DeleteObjects", "DeleteBucket", "AbortMultipartUpload"]);

/**
 * The Durable Object namespaces of WOW's Worker, from its invocations over the last 30 days: the
 * object datasets name namespaces, not scripts.
 */
const NAMESPACES_QUERY = `query ($account: String!, $script: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: {accountTag: $account}) {
      namespaces: durableObjectsInvocationsAdaptiveGroups(
        limit: 100
        filter: {scriptName: $script, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        dimensions { namespaceId }
      }
    }
  }
}`;

/** One hour of WOW's usage (the account runs other projects too: everything is filtered to WOW's). */
const HOUR_QUERY = `query (
  $account: String!
  $start: Time!
  $end: Time!
  $script: String!
  $namespaces: [string!]!
  $database: string!
  $bucket: string!
  $sfuApp: string!
  $turnKey: string!
) {
  viewer {
    accounts(filter: {accountTag: $account}) {
      doPeriodic: durableObjectsPeriodicGroups(
        limit: 10000
        filter: {namespaceId_in: $namespaces, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        dimensions { name }
        sum { duration inboundWebsocketMsgCount rowsRead rowsWritten }
      }
      doInvocations: durableObjectsInvocationsAdaptiveGroups(
        limit: 10000
        filter: {scriptName: $script, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        dimensions { name }
        sum { requests }
      }
      doStorage: durableObjectsStorageGroups(
        limit: 100
        filter: {namespaceIds_hasany: $namespaces, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        max { storedBytes }
      }
      doSqlStorage: durableObjectsSqlStorageGroups(
        limit: 100
        filter: {namespaceId_in: $namespaces, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        dimensions { namespaceId }
        max { storedBytes }
      }
      workers: workersInvocationsAdaptive(
        limit: 100
        filter: {scriptName: $script, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        sum { requests cpuTimeUs }
      }
      d1: d1AnalyticsAdaptiveGroups(
        limit: 100
        filter: {databaseId: $database, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        sum { rowsRead rowsWritten }
      }
      d1Storage: d1StorageAdaptiveGroups(
        limit: 100
        filter: {databaseId: $database, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        max { databaseSizeBytes }
      }
      r2Operations: r2OperationsAdaptiveGroups(
        limit: 1000
        filter: {bucketName: $bucket, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        dimensions { actionType }
        sum { requests }
      }
      r2Storage: r2StorageAdaptiveGroups(
        limit: 100
        filter: {bucketName: $bucket, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        max { payloadSize metadataSize }
      }
      sfu: callsUsageAdaptiveGroups(
        limit: 100
        filter: {appId: $sfuApp, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        sum { egressBytes }
      }
      turn: callsTurnUsageAdaptiveGroups(
        limit: 100
        filter: {keyId: $turnKey, datetimeHour_geq: $start, datetimeHour_lt: $end}
      ) {
        sum { egressBytes }
      }
    }
  }
}`;

type Sum<S> = {sum: S};
type Max<M> = {max: M};
type HourUsage = {
  doPeriodic: (Sum<{
    duration: number;
    inboundWebsocketMsgCount: number;
    rowsRead: number;
    rowsWritten: number;
  }> & {dimensions: {name: string | null}})[];
  doInvocations: (Sum<{requests: number}> & {dimensions: {name: string | null}})[];
  doStorage: Max<{storedBytes: number}>[];
  doSqlStorage: Max<{storedBytes: number}>[];
  workers: Sum<{requests: number; cpuTimeUs: number}>[];
  d1: Sum<{rowsRead: number; rowsWritten: number}>[];
  d1Storage: Max<{databaseSizeBytes: number}>[];
  r2Operations: (Sum<{requests: number}> & {dimensions: {actionType: string}})[];
  r2Storage: Max<{payloadSize: number; metadataSize: number}>[];
  sfu: Sum<{egressBytes: number}>[];
  turn: Sum<{egressBytes: number}>[];
};

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({query, variables: {account: env.CLOUDFLARE_ACCOUNT_ID, ...variables}}),
  });
  const body: {data: {viewer: {accounts: T[]}} | null; errors: unknown[] | null} =
    await response.json();
  if (!response.ok || body.errors?.length || !body.data) {
    throw new Error(`Usage import: GraphQL ${response.status} ${JSON.stringify(body.errors)}`);
  }
  return body.data.viewer.accounts[0]!;
}

/** WOW's resources, in this environment's config (wrangler.jsonc). */
async function sources(now: Date) {
  // The postinstall's `wrangler types --strict-vars=false` types JSON vars as plain `object`.
  const {script, d1DatabaseId, r2Bucket} = env.USAGE_SOURCES as {
    script: string;
    d1DatabaseId: string;
    r2Bucket: string;
  };
  const {namespaces} = await graphql<{namespaces: {dimensions: {namespaceId: string}}[]}>(
    NAMESPACES_QUERY,
    {script, start: toHour(new Date(now.getTime() - 30 * 24 * HOUR_MS)), end: toHour(now)}
  );
  return {
    script,
    namespaces: namespaces.map(g => g.dimensions.namespaceId),
    database: d1DatabaseId,
    bucket: r2Bucket,
    sfuApp: env.SFU_APP_ID,
    turnKey: env.TURN_SERVER_APP_ID,
  };
}

const fetchHour = (hour: string, filters: Awaited<ReturnType<typeof sources>>) =>
  graphql<HourUsage>(HOUR_QUERY, {start: hour, end: hourAfter(hour), ...filters});

const hourAfter = (hour: string) => toHour(new Date(Date.parse(hour) + HOUR_MS));
/** "2026-11-23T14:00:00Z", the form Cloudflare's analytics use. */
const toHour = (date: Date) => `${date.toISOString().slice(0, 13)}:00:00Z`;
const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

/**
 * The workspace each Durable Object belongs to, by the name it was created with (`getByName`): a
 * workspace id (WorkspaceRoom, NotificationRoom), slug (PresenceRoom), Discord guild id
 * (DiscordClient), `team:<workspace id>` (team chat) or puzzle id (puzzle chat, whiteboard, sheet).
 * Names of deleted workspaces and puzzles have none.
 */
async function workspacesByName(names: string[]) {
  const byName = new Map<string, string>();
  const plain = [...new Set(names.map(name => name.replace(/^team:/, "")))];
  await Promise.all(
    chunks(plain, 30).map(async batch => {
      const [workspaces, puzzles] = await Promise.all([
        db
          .select({
            id: schema.organization.id,
            slug: schema.organization.slug,
            guild: schema.organization.discordGuildId,
          })
          .from(schema.organization)
          .where(
            or(
              inArray(schema.organization.id, batch),
              inArray(schema.organization.slug, batch),
              inArray(schema.organization.discordGuildId, batch)
            )
          ),
        db
          .select({id: schema.puzzle.id, workspaceId: schema.round.workspaceId})
          .from(schema.puzzle)
          .innerJoin(schema.round, eq(schema.round.id, schema.puzzle.roundId))
          .where(inArray(schema.puzzle.id, batch)),
      ]);
      for (const {id, slug, guild} of workspaces) {
        byName.set(id, id);
        byName.set(slug, id);
        if (guild) byName.set(guild, id);
      }
      for (const {id, workspaceId} of puzzles) byName.set(id, workspaceId);
    })
  );
  return new Map(
    names.flatMap(name => {
      const workspaceId = byName.get(name.replace(/^team:/, ""));
      return workspaceId ? [[name, workspaceId] as const] : [];
    })
  );
}

/** Each workspace's Durable Object usage over the hour ("" for objects that belong to none). */
async function durableObjectUsage(usage: HourUsage) {
  type Totals = {
    requests: number;
    wsMessagesIn: number;
    gbSeconds: number;
    rowsRead: number;
    rowsWritten: number;
  };
  const names = [
    ...usage.doPeriodic.map(g => g.dimensions.name),
    ...usage.doInvocations.map(g => g.dimensions.name),
  ].filter(name => name !== null);
  const workspaceOf = await workspacesByName([...new Set(names)]);
  const byWorkspace = new Map<string, Totals>();
  const totals = (name: string | null) => {
    const workspaceId = (name !== null && workspaceOf.get(name)) || "";
    let entry = byWorkspace.get(workspaceId);
    if (!entry) {
      entry = {requests: 0, wsMessagesIn: 0, gbSeconds: 0, rowsRead: 0, rowsWritten: 0};
      byWorkspace.set(workspaceId, entry);
    }
    return entry;
  };
  for (const {dimensions, sum} of usage.doPeriodic) {
    const entry = totals(dimensions.name);
    entry.wsMessagesIn += sum.inboundWebsocketMsgCount;
    entry.gbSeconds += sum.duration; // billed duration: active time × 128 MB
    entry.rowsRead += sum.rowsRead;
    entry.rowsWritten += sum.rowsWritten;
  }
  for (const {dimensions, sum} of usage.doInvocations)
    totals(dimensions.name).requests += sum.requests;
  return byWorkspace;
}

/** The hour's readings: per workspace Durable Object usage, then account totals. */
async function readings(hour: string, usage: HourUsage) {
  const points: Reading[] = [];
  // Zero readings are left out: they add nothing to a sum, and points are limited.
  const account = (meterName: Meter, quantity: number) => {
    if (quantity > 0) points.push({workspaceId: null, meter: meterName, quantity, hour});
  };

  for (const [workspaceId, totals] of await durableObjectUsage(usage)) {
    points.push({
      workspaceId: workspaceId || null,
      meter: "do_hourly",
      quantity: totals.gbSeconds,
      hour,
      doubles: [totals.requests, totals.wsMessagesIn, totals.rowsRead, totals.rowsWritten],
    });
  }
  account(
    "do_stored_bytes",
    total(usage.doStorage.map(g => g.max.storedBytes)) +
      total(usage.doSqlStorage.map(g => g.max.storedBytes))
  );
  account("worker_requests_total", total(usage.workers.map(g => g.sum.requests)));
  account("worker_cpu_ms", total(usage.workers.map(g => g.sum.cpuTimeUs)) / 1000);
  account("d1_rows_read", total(usage.d1.map(g => g.sum.rowsRead)));
  account("d1_rows_written", total(usage.d1.map(g => g.sum.rowsWritten)));
  account("d1_stored_bytes", total(usage.d1Storage.map(g => g.max.databaseSizeBytes)));
  const r2 = (classOf: (action: string) => boolean) =>
    total(
      usage.r2Operations.filter(g => classOf(g.dimensions.actionType)).map(g => g.sum.requests)
    );
  account(
    "r2_class_a_ops_total",
    r2(a => !R2_CLASS_B.has(a) && !R2_FREE.has(a))
  );
  account(
    "r2_class_b_ops_total",
    r2(a => R2_CLASS_B.has(a))
  );
  account(
    "r2_stored_bytes",
    total(usage.r2Storage.map(g => g.max.payloadSize + g.max.metadataSize))
  );
  account("sfu_egress_bytes", total(usage.sfu.map(g => g.sum.egressBytes)));
  account("turn_egress_bytes", total(usage.turn.map(g => g.sum.egressBytes)));
  return points;
}

/** Imports every complete hour not imported yet, as many as fit in this invocation. */
export async function importUsage(now = new Date()) {
  const last = await db
    .select({hour: schema.usageImports.hour})
    .from(schema.usageImports)
    .orderBy(desc(schema.usageImports.hour))
    .limit(1)
    .get();
  const end = toHour(now); // the current hour, still in progress
  let hour = last
    ? hourAfter(last.hour)
    : toHour(new Date(Date.parse(end) - FIRST_IMPORT_HOURS * HOUR_MS));
  const filters = await sources(now);
  let written = 0;
  for (; hour < end; hour = hourAfter(hour)) {
    // oxlint-disable-next-line no-await-in-loop -- one hour at a time, oldest first.
    const points = await readings(hour, await fetchHour(hour, filters));
    if (written + points.length > MAX_POINTS) {
      // The rest next hour. One hour alone never fits only past ~240 workspaces active at once.
      if (written === 0) throw new Error(`Usage import: ${hour} has ${points.length} readings`);
      break;
    }
    // Claimed before writing, so a run never writes an hour another run did.
    // oxlint-disable-next-line no-await-in-loop -- one hour at a time, oldest first.
    const claimed = await db
      .insert(schema.usageImports)
      .values({hour})
      .onConflictDoNothing()
      .returning()
      .get();
    if (!claimed) continue;
    for (const point of points) meter(point);
    written += points.length;
  }
  return written;
}
