import { describe, expect, it } from "vitest";

import { MetricsRegistry } from "@/lib/metrics";

describe("MetricsRegistry", () => {
  it("collects counters with escaped labels", () => {
    const registry = new MetricsRegistry();
    const counter = registry.counter("test_events_total", "Total test events.", ["route"]);

    counter.inc({ route: '/api/"quoted"' });
    counter.inc({ route: '/api/"quoted"' }, 2);

    expect(registry.collect()).toContain('test_events_total{route="/api/\\"quoted\\""} 3');
  });

  it("collects histogram buckets, sum, and count", () => {
    const registry = new MetricsRegistry();
    const histogram = registry.histogram(
      "test_duration_seconds",
      "Test duration.",
      ["status"],
      [0.1, 0.5, 1]
    );

    histogram.observe({ status: "ok" }, 0.4);
    histogram.observe({ status: "ok" }, 1.5);

    const output = registry.collect();
    expect(output).toContain('test_duration_seconds_bucket{status="ok",le="0.5"} 1');
    expect(output).toContain('test_duration_seconds_bucket{status="ok",le="+Inf"} 2');
    expect(output).toContain('test_duration_seconds_sum{status="ok"} 1.9');
    expect(output).toContain('test_duration_seconds_count{status="ok"} 2');
  });
});
