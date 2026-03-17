import { createHash } from "node:crypto";
import { getDb } from "../data/cache.js";

export function logToolCall(params: {
  clientIp: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
}): void {
  const db = getDb();
  const paramsHash = createHash("sha256")
    .update(JSON.stringify(params.toolParams))
    .digest("hex")
    .slice(0, 16);

  db.prepare(
    `INSERT INTO usage_logs (api_key, tool_name, params_hash, response_time_ms, success, error_message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    params.clientIp,
    params.toolName,
    paramsHash,
    params.responseTimeMs,
    params.success ? 1 : 0,
    params.errorMessage ?? null
  );
}

export interface UsageStats {
  totalCalls: number;
  todayCalls: number;
  weekCalls: number;
  uniqueClients: number;
  avgResponseMs: number;
  errorRate: number;
  byTool: Array<{ tool: string; count: number }>;
  topUsers: Array<{ key: string; count: number }>;
  recentHours: Array<{ hour: string; count: number }>;
}

export function getUsageStats(): UsageStats {
  const db = getDb();

  const totalCalls =
    (db.prepare("SELECT COUNT(*) as c FROM usage_logs").get() as { c: number })
      .c;

  const todayCalls =
    (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM usage_logs WHERE created_at >= datetime('now', '-1 day')"
        )
        .get() as { c: number }
    ).c;

  const weekCalls =
    (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM usage_logs WHERE created_at >= datetime('now', '-7 days')"
        )
        .get() as { c: number }
    ).c;

  const uniqueClients =
    (
      db
        .prepare(
          "SELECT COUNT(DISTINCT api_key) as c FROM usage_logs WHERE api_key IS NOT NULL"
        )
        .get() as { c: number }
    ).c;

  const avgResponseMs =
    (
      db
        .prepare("SELECT AVG(response_time_ms) as avg FROM usage_logs")
        .get() as { avg: number | null }
    ).avg ?? 0;

  const errorCount =
    (
      db
        .prepare("SELECT COUNT(*) as c FROM usage_logs WHERE success = 0")
        .get() as { c: number }
    ).c;

  const errorRate = totalCalls > 0 ? (errorCount / totalCalls) * 100 : 0;

  const byTool = db
    .prepare(
      "SELECT tool_name as tool, COUNT(*) as count FROM usage_logs GROUP BY tool_name ORDER BY count DESC"
    )
    .all() as Array<{ tool: string; count: number }>;

  const topUsers = db
    .prepare(
      `SELECT COALESCE(api_key, 'anonymous') as key, COUNT(*) as count
       FROM usage_logs GROUP BY api_key ORDER BY count DESC LIMIT 10`
    )
    .all() as Array<{ key: string; count: number }>;

  const recentHours = db
    .prepare(
      `SELECT strftime('%Y-%m-%d %H:00', created_at) as hour, COUNT(*) as count
       FROM usage_logs WHERE created_at >= datetime('now', '-24 hours')
       GROUP BY hour ORDER BY hour`
    )
    .all() as Array<{ hour: string; count: number }>;

  return {
    totalCalls,
    todayCalls,
    weekCalls,
    uniqueClients,
    avgResponseMs: Math.round(avgResponseMs),
    errorRate: Math.round(errorRate * 100) / 100,
    byTool,
    topUsers,
    recentHours,
  };
}
