import {describe, expect, it} from "vite-plus/test";

import {costHour, type HourReading, PRICES} from "./usage-cost-plan";

const account = (meter: string, quantity: number): HourReading => ({
  workspaceId: "",
  meter,
  quantities: [quantity],
});
const app = (workspaceId: string, meter: string, quantity: number): HourReading => ({
  workspaceId,
  meter,
  quantities: [quantity],
});
const total = (costs: ReturnType<typeof costHour>) =>
  [...costs.values()].reduce(
    (sum, c) => sum + c.workers + c.durableObjects + c.d1 + c.r2 + c.realtime,
    0
  );

describe("costHour", () => {
  it("splits Worker totals by each workspace's share of requests", () => {
    const costs = costHour([
      account("worker_requests_total", 1_000_000),
      account("worker_cpu_ms", 2_000_000),
      app("a", "worker_requests", 300),
      app("b", "worker_requests", 100),
    ]);
    const usd = 1_000_000 * PRICES.workerRequest + 2_000_000 * PRICES.workerCpuMs;
    expect(costs.get("a")?.workers).toBeCloseTo(usd * 0.75, 12);
    expect(costs.get("b")?.workers).toBeCloseTo(usd * 0.25, 12);
    expect(costs.has("")).toBe(false);
  });

  it("charges each workspace its own Durable Objects, websocket messages at 20:1", () => {
    const costs = costHour([
      {workspaceId: "a", meter: "do_hourly", quantities: [400_000, 1_000_000, 2_000_000, 0, 0]},
      {workspaceId: "", meter: "do_hourly", quantities: [0, 1_000_000, 0, 0, 0]},
    ]);
    expect(costs.get("a")?.durableObjects).toBeCloseTo(
      400_000 * PRICES.doGbSecond + 1_100_000 * PRICES.doRequest,
      12
    );
    // Objects of no workspace (a deleted puzzle's) are overhead.
    expect(costs.get("")?.durableObjects).toBeCloseTo(1_000_000 * PRICES.doRequest, 12);
  });

  it("splits R2 operations by R2 share, falling back to the request share", () => {
    const costs = costHour([
      account("r2_class_a_ops_total", 1_000_000),
      account("r2_class_b_ops_total", 1_000_000),
      app("a", "r2_class_a_ops", 10),
      app("a", "worker_requests", 1),
      app("b", "worker_requests", 1),
    ]);
    // Class A: only "a" wrote; class B: no app reads, so half each by requests.
    expect(costs.get("a")?.r2).toBeCloseTo(1e6 * (PRICES.r2ClassA + PRICES.r2ClassB / 2), 12);
    expect(costs.get("b")?.r2).toBeCloseTo((1e6 * PRICES.r2ClassB) / 2, 12);
  });

  it("splits voice egress by media stream seconds", () => {
    const costs = costHour([
      account("sfu_egress_bytes", 6e9),
      account("turn_egress_bytes", 4e9),
      app("a", "sfu_stream_seconds", 30),
      app("b", "sfu_stream_seconds", 10),
      app("b", "worker_requests", 1),
    ]);
    expect(costs.get("a")?.realtime).toBeCloseTo(10 * PRICES.realtimeEgressGb * 0.75, 12);
    expect(costs.get("b")?.realtime).toBeCloseTo(10 * PRICES.realtimeEgressGb * 0.25, 12);
  });

  it("prices storage peaks by the hour's share of a month", () => {
    const costs = costHour([account("d1_stored_bytes", 730e9), app("a", "worker_requests", 5)]);
    expect(costs.get("a")?.d1).toBeCloseTo(PRICES.d1StoredGbMonth, 12);
  });

  it("keeps an hour with no workspace activity as overhead, so the total adds up", () => {
    const readings = [
      account("worker_requests_total", 10),
      account("d1_rows_written", 1000),
      account("r2_stored_bytes", 1e9),
    ];
    const costs = costHour(readings);
    expect([...costs.keys()]).toEqual([""]);
    expect(total(costs)).toBeCloseTo(
      10 * PRICES.workerRequest + 1000 * PRICES.d1RowWritten + PRICES.r2StoredGbMonth / 730,
      12
    );
  });

  it("allocates the whole account total among active workspaces", () => {
    const readings = [
      account("worker_requests_total", 5000),
      account("worker_cpu_ms", 90_000),
      account("d1_rows_read", 1e6),
      account("r2_class_b_ops_total", 400),
      app("a", "worker_requests", 7),
      app("b", "worker_requests", 3),
      app("b", "r2_class_b_ops", 2),
    ];
    const expected =
      5000 * PRICES.workerRequest +
      90_000 * PRICES.workerCpuMs +
      1e6 * PRICES.d1RowRead +
      400 * PRICES.r2ClassB;
    expect(total(costHour(readings))).toBeCloseTo(expected, 12);
  });

  it("ignores meters it doesn't know", () => {
    expect(costHour([app("a", "something_else", 99)]).size).toBe(0);
  });
});
