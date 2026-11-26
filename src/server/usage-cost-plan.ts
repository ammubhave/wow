/**
 * Turning one hour of usage readings (src/server/usage.ts) into what each workspace cost, in US
 * dollars at Cloudflare's list prices. Pure, so it can be tested; src/server/usage-cost.ts reads the
 * readings and stores the result.
 *
 * Prices are pay-as-you-go rates with no included allowances: the account's free allowances and
 * $5 base fee are shared with other projects, so a workspace's cost is what its usage would cost
 * on its own. Sources (checked 2026-11):
 * - Workers https://developers.cloudflare.com/workers/platform/pricing/
 * - Durable Objects https://developers.cloudflare.com/durable-objects/platform/pricing/
 * - D1 https://developers.cloudflare.com/d1/platform/pricing/
 * - R2 https://developers.cloudflare.com/r2/pricing/
 * - Realtime (SFU and TURN) https://developers.cloudflare.com/realtime/sfu/pricing/
 *
 * How usage is attributed:
 * - Durable Objects: each workspace's own objects, measured per object (`do_hourly`).
 * - What Cloudflare reports only as account totals is split between the workspaces active that
 *   hour by their share of what the app measured for them: Worker requests, CPU time, D1 and
 *   storage by Worker requests; R2 operations by R2 operations of that class; voice and video
 *   egress by media stream seconds. With no app measurement for that share, it falls back to the
 *   Worker request share.
 * - What belongs to no workspace (objects of deleted puzzles, an hour with no workspace activity)
 *   is overhead, kept under workspace "" so the account total still adds up.
 */

export const PRICES = {
  workerRequest: 0.3 / 1e6,
  workerCpuMs: 0.02 / 1e6,
  doRequest: 0.15 / 1e6,
  /** Inbound WebSocket messages are billed as requests at 20:1. */
  doWebSocketMessagesPerRequest: 20,
  doGbSecond: 12.5 / 1e6,
  doRowRead: 0.001 / 1e6,
  doRowWritten: 1 / 1e6,
  doStoredGbMonth: 0.2,
  d1RowRead: 0.001 / 1e6,
  d1RowWritten: 1 / 1e6,
  d1StoredGbMonth: 0.75,
  r2ClassA: 4.5 / 1e6,
  r2ClassB: 0.36 / 1e6,
  r2StoredGbMonth: 0.015,
  realtimeEgressGb: 0.05,
} as const;

/** Storage is priced per GB-month; readings are hourly peaks. */
const HOURS_PER_MONTH = 730;
const GB = 1e9;

export const SERVICES = ["workers", "durableObjects", "d1", "r2", "realtime"] as const;
export type Service = (typeof SERVICES)[number];
export type ServiceCosts = Record<Service, number>;

/** One workspace's (or the account's, workspace "") summed readings of one meter in the hour. */
export type HourReading = {workspaceId: string; meter: string; quantities: number[]};

/** Each workspace's cost in the hour, by service ("" = overhead attributed to no workspace). */
export function costHour(readings: HourReading[]): Map<string, ServiceCosts> {
  const byMeter = new Map<string, Map<string, number[]>>();
  for (const {workspaceId, meter, quantities} of readings) {
    let workspaces = byMeter.get(meter);
    if (!workspaces) byMeter.set(meter, (workspaces = new Map()));
    const sum = workspaces.get(workspaceId) ?? [];
    quantities.forEach((quantity, i) => (sum[i] = (sum[i] ?? 0) + quantity));
    workspaces.set(workspaceId, sum);
  }
  /** An account total (workspace ""), in the reading's first quantity. */
  const accountTotal = (meter: string) => byMeter.get(meter)?.get("")?.[0] ?? 0;
  /** Each workspace's share of an app-measured meter (workspace "" readings don't take part). */
  const shares = (meter: string) => {
    const amounts = [...(byMeter.get(meter) ?? [])]
      .filter(([workspaceId]) => workspaceId !== "")
      .map(([workspaceId, quantities]) => [workspaceId, quantities[0] ?? 0] as const)
      .filter(([, amount]) => amount > 0);
    const sum = amounts.reduce((total, [, amount]) => total + amount, 0);
    return new Map(amounts.map(([workspaceId, amount]) => [workspaceId, amount / sum]));
  };

  const costs = new Map<string, ServiceCosts>();
  const add = (workspaceId: string, service: Service, usd: number) => {
    if (usd <= 0) return;
    let entry = costs.get(workspaceId);
    if (!entry) {
      entry = {workers: 0, durableObjects: 0, d1: 0, r2: 0, realtime: 0};
      costs.set(workspaceId, entry);
    }
    entry[service] += usd;
  };
  const requestShares = shares("worker_requests");
  /** Splits `usd` by `split` (or the Worker request share), or keeps it as overhead. */
  const allocate = (service: Service, usd: number, split = requestShares) => {
    const by = split.size > 0 ? split : requestShares;
    if (by.size === 0) return add("", service, usd);
    for (const [workspaceId, share] of by) add(workspaceId, service, usd * share);
  };
  const storage = (meter: string, pricePerGbMonth: number) =>
    (accountTotal(meter) / GB) * (pricePerGbMonth / HOURS_PER_MONTH);

  allocate(
    "workers",
    accountTotal("worker_requests_total") * PRICES.workerRequest +
      accountTotal("worker_cpu_ms") * PRICES.workerCpuMs
  );

  for (const [
    workspaceId,
    [gbSeconds = 0, requests = 0, wsIn = 0, rowsRead = 0, rowsWritten = 0],
  ] of byMeter.get("do_hourly") ?? []) {
    const usd =
      gbSeconds * PRICES.doGbSecond +
      (requests + wsIn / PRICES.doWebSocketMessagesPerRequest) * PRICES.doRequest +
      rowsRead * PRICES.doRowRead +
      rowsWritten * PRICES.doRowWritten;
    add(workspaceId, "durableObjects", usd);
  }
  allocate("durableObjects", storage("do_stored_bytes", PRICES.doStoredGbMonth));

  allocate(
    "d1",
    accountTotal("d1_rows_read") * PRICES.d1RowRead +
      accountTotal("d1_rows_written") * PRICES.d1RowWritten +
      storage("d1_stored_bytes", PRICES.d1StoredGbMonth)
  );

  allocate("r2", accountTotal("r2_class_a_ops_total") * PRICES.r2ClassA, shares("r2_class_a_ops"));
  allocate("r2", accountTotal("r2_class_b_ops_total") * PRICES.r2ClassB, shares("r2_class_b_ops"));
  allocate("r2", storage("r2_stored_bytes", PRICES.r2StoredGbMonth));

  allocate(
    "realtime",
    ((accountTotal("sfu_egress_bytes") + accountTotal("turn_egress_bytes")) / GB) *
      PRICES.realtimeEgressGb,
    shares("sfu_stream_seconds")
  );
  return costs;
}
