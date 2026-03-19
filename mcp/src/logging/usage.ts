import { createHash } from "node:crypto";
import { getPool } from "../data/db.js";

export async function logToolCall(params: {
  clientIp: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  const paramsHash = createHash("sha256")
    .update(JSON.stringify(params.toolParams))
    .digest("hex")
    .slice(0, 16);

  await getPool().query(
    `INSERT INTO usage_logs (api_key, tool_name, params_hash, response_time_ms, success, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.clientIp,
      params.toolName,
      paramsHash,
      params.responseTimeMs,
      params.success ? 1 : 0,
      params.errorMessage ?? null,
    ]
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

export async function getUsageStats(): Promise<UsageStats> {
  const pool = getPool();

  const totalRes = await pool.query<{ c: string }>("SELECT COUNT(*) as c FROM usage_logs");
  const totalCalls = Number(totalRes.rows[0].c);

  const todayRes = await pool.query<{ c: string }>(
    "SELECT COUNT(*) as c FROM usage_logs WHERE created_at >= NOW() - INTERVAL '1 day'"
  );
  const todayCalls = Number(todayRes.rows[0].c);

  const weekRes = await pool.query<{ c: string }>(
    "SELECT COUNT(*) as c FROM usage_logs WHERE created_at >= NOW() - INTERVAL '7 days'"
  );
  const weekCalls = Number(weekRes.rows[0].c);

  const uniqueRes = await pool.query<{ c: string }>(
    "SELECT COUNT(DISTINCT api_key) as c FROM usage_logs WHERE api_key IS NOT NULL"
  );
  const uniqueClients = Number(uniqueRes.rows[0].c);

  const avgRes = await pool.query<{ avg: string | null }>("SELECT AVG(response_time_ms) as avg FROM usage_logs");
  const avgResponseMs = avgRes.rows[0].avg != null ? Number(avgRes.rows[0].avg) : 0;

  const errorRes = await pool.query<{ c: string }>("SELECT COUNT(*) as c FROM usage_logs WHERE success = 0");
  const errorCount = Number(errorRes.rows[0].c);
  const errorRate = totalCalls > 0 ? (errorCount / totalCalls) * 100 : 0;

  const byToolRes = await pool.query<{ tool: string; count: string }>(
    "SELECT tool_name as tool, COUNT(*)::int as count FROM usage_logs GROUP BY tool_name ORDER BY count DESC"
  );
  const byTool = byToolRes.rows.map((r: { tool: string; count: string }) => ({ tool: r.tool, count: Number(r.count) }));

  const topUsersRes = await pool.query<{ key: string; count: string }>(
    `SELECT COALESCE(api_key, 'anonymous') as key, COUNT(*)::int as count
     FROM usage_logs GROUP BY api_key ORDER BY count DESC LIMIT 10`
  );
  const topUsers = topUsersRes.rows.map((r: { key: string; count: string }) => ({ key: r.key, count: Number(r.count) }));

  const recentRes = await pool.query<{ hour: string; count: string }>(
    `SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') as hour, COUNT(*)::int as count
     FROM usage_logs WHERE created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY date_trunc('hour', created_at) ORDER BY hour`
  );
  const recentHours = recentRes.rows.map((r: { hour: string; count: string }) => ({ hour: r.hour.trim(), count: Number(r.count) }));

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
