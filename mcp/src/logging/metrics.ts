import { getPool, hasDatabase } from "../data/db.js";

interface MetricsBucket {
  toolCalls: Map<string, number>;
  errors: Map<string, number>;
  responseTimes: number[];
  cacheHits: number;
  cacheMisses: number;
  rateLimitHits: number;
}

const bucket: MetricsBucket = {
  toolCalls: new Map(),
  errors: new Map(),
  responseTimes: [],
  cacheHits: 0,
  cacheMisses: 0,
  rateLimitHits: 0,
};

export function recordToolCall(tool: string, durationMs: number, success: boolean) {
  bucket.toolCalls.set(tool, (bucket.toolCalls.get(tool) ?? 0) + 1);
  bucket.responseTimes.push(durationMs);
  if (!success) {
    bucket.errors.set(tool, (bucket.errors.get(tool) ?? 0) + 1);
  }
}

export function recordCacheHit() {
  bucket.cacheHits++;
}

export function recordCacheMiss() {
  bucket.cacheMisses++;
}

export function recordRateLimitHit() {
  bucket.rateLimitHits++;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export async function getPrometheusMetrics(): Promise<string> {
  const lines: string[] = [];
  const now = Date.now();

  lines.push("# HELP syenite_tool_calls_total Total tool calls by tool name");
  lines.push("# TYPE syenite_tool_calls_total counter");
  for (const [tool, count] of bucket.toolCalls) {
    lines.push(`syenite_tool_calls_total{tool="${tool}"} ${count}`);
  }

  lines.push("# HELP syenite_tool_errors_total Total tool errors by tool name");
  lines.push("# TYPE syenite_tool_errors_total counter");
  for (const [tool, count] of bucket.errors) {
    lines.push(`syenite_tool_errors_total{tool="${tool}"} ${count}`);
  }

  const sorted = bucket.responseTimes.slice().sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  lines.push("# HELP syenite_response_time_ms Response time percentiles");
  lines.push("# TYPE syenite_response_time_ms gauge");
  lines.push(`syenite_response_time_ms{quantile="0.5"} ${p50}`);
  lines.push(`syenite_response_time_ms{quantile="0.95"} ${p95}`);
  lines.push(`syenite_response_time_ms{quantile="0.99"} ${p99}`);

  lines.push("# HELP syenite_cache_hits_total Cache hits");
  lines.push("# TYPE syenite_cache_hits_total counter");
  lines.push(`syenite_cache_hits_total ${bucket.cacheHits}`);

  lines.push("# HELP syenite_cache_misses_total Cache misses");
  lines.push("# TYPE syenite_cache_misses_total counter");
  lines.push(`syenite_cache_misses_total ${bucket.cacheMisses}`);

  const hitRate =
    bucket.cacheHits + bucket.cacheMisses > 0
      ? bucket.cacheHits / (bucket.cacheHits + bucket.cacheMisses)
      : 0;
  lines.push("# HELP syenite_cache_hit_rate Cache hit ratio (0-1)");
  lines.push("# TYPE syenite_cache_hit_rate gauge");
  lines.push(`syenite_cache_hit_rate ${hitRate.toFixed(4)}`);

  lines.push("# HELP syenite_rate_limit_hits_total Rate limit rejections");
  lines.push("# TYPE syenite_rate_limit_hits_total counter");
  lines.push(`syenite_rate_limit_hits_total ${bucket.rateLimitHits}`);

  lines.push("# HELP syenite_uptime_seconds Process uptime");
  lines.push("# TYPE syenite_uptime_seconds gauge");
  lines.push(`syenite_uptime_seconds ${Math.round(process.uptime())}`);

    if (hasDatabase()) {
      try {
        const res = await getPool().query<{ c: string }>(
          "SELECT COUNT(*) as c FROM cache WHERE expires_at > $1",
          [Math.floor(now / 1000)]
        );
        const activeCacheEntries = Number(res.rows[0].c);
        lines.push("# HELP syenite_cache_entries Active cache entries");
        lines.push("# TYPE syenite_cache_entries gauge");
        lines.push(`syenite_cache_entries ${activeCacheEntries}`);
      } catch {
        // DB unavailable — skip cache entry count
      }
    }

  return lines.join("\n") + "\n";
}
