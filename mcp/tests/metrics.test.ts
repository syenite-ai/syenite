import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/data/db.js", () => ({
  hasDatabase: () => false,
  getPool: () => { throw new Error("No DB"); },
}));

import {
  recordToolCall,
  recordCacheHit,
  recordCacheMiss,
  recordRateLimitHit,
  getPrometheusMetrics,
} from "../src/logging/metrics.js";

describe("Prometheus Metrics", () => {
  it("tracks tool calls", async () => {
    recordToolCall("lending.rates.query", 150, true);
    recordToolCall("lending.rates.query", 200, true);
    recordToolCall("swap.quote", 300, false);

    const output = await getPrometheusMetrics();

    expect(output).toContain('syenite_tool_calls_total{tool="lending.rates.query"} 2');
    expect(output).toContain('syenite_tool_calls_total{tool="swap.quote"} 1');
    expect(output).toContain('syenite_tool_errors_total{tool="swap.quote"} 1');
  });

  it("tracks cache hits and misses", async () => {
    recordCacheHit();
    recordCacheHit();
    recordCacheMiss();

    const output = await getPrometheusMetrics();

    expect(output).toContain("syenite_cache_hits_total");
    expect(output).toContain("syenite_cache_misses_total");
    expect(output).toContain("syenite_cache_hit_rate");
  });

  it("tracks rate limit hits", async () => {
    recordRateLimitHit();

    const output = await getPrometheusMetrics();
    expect(output).toContain("syenite_rate_limit_hits_total");
  });

  it("outputs valid Prometheus format", async () => {
    const output = await getPrometheusMetrics();
    const lines = output.split("\n").filter((l) => l && !l.startsWith("#"));

    for (const line of lines) {
      // Each metric line should match: metric_name{labels} value
      // or: metric_name value
      expect(line).toMatch(/^[a-z_]+(\{[^}]+\})?\s+[\d.]+$/);
    }
  });

  it("includes response time percentiles", async () => {
    for (let i = 0; i < 10; i++) {
      recordToolCall("perf_test", 100 + i * 10, true);
    }

    const output = await getPrometheusMetrics();
    expect(output).toContain('syenite_response_time_ms{quantile="0.5"}');
    expect(output).toContain('syenite_response_time_ms{quantile="0.95"}');
    expect(output).toContain('syenite_response_time_ms{quantile="0.99"}');
  });

  it("includes uptime", async () => {
    const output = await getPrometheusMetrics();
    expect(output).toContain("syenite_uptime_seconds");
  });
});
