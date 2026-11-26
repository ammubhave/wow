import {env} from "cloudflare:workers";
import {and, eq, isNull, lt, sql} from "drizzle-orm";

import {chunks} from "@/lib/chunks";
import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {costHour, type HourReading, SERVICES} from "./usage-cost-plan";

/**
 * What each workspace has cost: every hour, the usage readings in Analytics Engine (usage.ts) are
 * priced and attributed (usage-cost-plan.ts) and stored in D1 (`workspace_cost`), where they stay
 * after Analytics Engine drops them (three months). `getWorkspaceCost` adds them up.
 *
 * An hour is costed once its Cloudflare numbers are imported (usage-import.ts, in the hour after)
 * and have had an hour to land in Analytics Engine, so costs run about two hours behind.
 */

const HOUR_MS = 60 * 60 * 1000;
/** Hours costed per cron run: each is one Analytics Engine query. */
const MAX_HOURS_PER_RUN = 48;

const toHour = (date: Date) => `${date.toISOString().slice(0, 13)}:00:00Z`;
/** "2026-11-23T14:00:00Z" → "2026-11-23 14:00:00", Analytics Engine's DateTime form. */
const toSqlTime = (hour: string) => hour.slice(0, 19).replace("T", " ");

type Row = {workspaceId: string; meter: string; [quantity: `q${number}`]: number};

/**
 * One hour's readings, summed per workspace and meter: the imported ones carry the hour they cover
 * (blob5); the app's own are timestamped as they happened.
 */
async function hourReadings(hour: string): Promise<HourReading[]> {
  const {dataset} = env.USAGE_SOURCES as {dataset: string};
  const start = toSqlTime(hour);
  const end = toSqlTime(toHour(new Date(Date.parse(hour) + HOUR_MS)));
  const quantities = [1, 2, 3, 4, 5].map(i => `SUM(_sample_interval * double${i}) AS q${i}`);
  const query = `SELECT blob1 AS workspaceId, blob2 AS meter, ${quantities.join(", ")}
    FROM ${dataset}
    WHERE timestamp >= toDateTime('${start}')
      AND (blob5 = '${hour}' OR (blob5 = '' AND timestamp < toDateTime('${end}')))
    GROUP BY workspaceId, meter
    FORMAT JSON`;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
    {method: "POST", headers: {Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`}, body: query}
  );
  if (!response.ok) {
    throw new Error(`Usage cost: Analytics Engine ${response.status} ${await response.text()}`);
  }
  const {data} = await response.json<{data: Row[]}>();
  return data.map(row => ({
    workspaceId: row.workspaceId,
    meter: row.meter,
    quantities: [row.q1, row.q2, row.q3, row.q4, row.q5].map(Number),
  }));
}

/** Hourly (src/index.ts): costs every imported hour not costed yet, oldest first. */
export async function costUsage(now = new Date()) {
  // Imported in the hour after, then given an hour to land in Analytics Engine.
  const before = toHour(new Date(Date.parse(toHour(now)) - HOUR_MS));
  const hours = await db
    .select({hour: schema.usageImports.hour})
    .from(schema.usageImports)
    .where(and(isNull(schema.usageImports.costedAt), lt(schema.usageImports.hour, before)))
    .orderBy(schema.usageImports.hour)
    .limit(MAX_HOURS_PER_RUN);
  for (const {hour} of hours) {
    // oxlint-disable-next-line no-await-in-loop -- one hour at a time, oldest first.
    const costs = costHour(await hourReadings(hour));
    const rows = [...costs].flatMap(([workspaceId, byService]) =>
      SERVICES.filter(service => byService[service] > 0).map(service => ({
        workspaceId,
        hour,
        service,
        usd: byService[service],
      }))
    );
    // Replaces the hour's rows, so costing an hour again is safe.
    // oxlint-disable-next-line no-await-in-loop -- one hour at a time, oldest first.
    await db.batch([
      db.delete(schema.workspaceCost).where(eq(schema.workspaceCost.hour, hour)),
      // D1 takes at most 100 bound values per statement: 4 per row.
      ...chunks(rows, 25).map(batch => db.insert(schema.workspaceCost).values(batch)),
      db
        .update(schema.usageImports)
        .set({costedAt: new Date()})
        .where(eq(schema.usageImports.hour, hour)),
    ]);
  }
  return hours.length;
}

/**
 * What a workspace has cost so far, in US dollars at Cloudflare's list prices (about two hours
 * behind). Members see only this total; the breakdown by service stays in `workspace_cost`.
 */
export async function getWorkspaceCost(workspaceId: string): Promise<number> {
  const total = await db
    .select({usd: sql<number | null>`sum(${schema.workspaceCost.usd})`})
    .from(schema.workspaceCost)
    .where(eq(schema.workspaceCost.workspaceId, workspaceId))
    .get();
  return total?.usd ?? 0;
}
