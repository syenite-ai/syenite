import { createHash } from "node:crypto";
import { getPool, hasDatabase } from "../data/db.js";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export { hashIp };

export async function logToolCall(params: {
  clientIp: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
  chain?: string;
  protocol?: string;
  asset?: string;
}): Promise<void> {
  if (!hasDatabase()) return;

  const paramsHash = createHash("sha256")
    .update(JSON.stringify(params.toolParams))
    .digest("hex")
    .slice(0, 16);

  await getPool().query(
    `INSERT INTO usage_logs (api_key, tool_name, params_hash, response_time_ms, success, error_message, chain, protocol, asset)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      hashIp(params.clientIp),
      params.toolName,
      paramsHash,
      params.responseTimeMs,
      params.success ? 1 : 0,
      params.errorMessage ?? null,
      params.chain ?? null,
      params.protocol ?? null,
      params.asset ?? null,
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
  byTool: Array<{ tool: string; count: number; errors: number }>;
  topUsers: Array<{ key: string; count: number }>;
  recentHours: Array<{ hour: string; count: number }>;
  recentErrors: Array<{ tool: string; message: string; at: string }>;
  byChain: Array<{ chain: string; calls: number; clients: number; errors: number }>;
  byProtocol: Array<{ protocol: string; calls: number; clients: number; errors: number }>;
  byAsset: Array<{ asset: string; calls: number; clients: number }>;
  retention: { returningClients2d: number; returningClients7d: number; totalClients: number };
  sessions: Array<{ clientKey: string; sessionStart: string; toolSequence: string[]; uniqueTools: number }>;
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

  const byToolRes = await pool.query<{ tool: string; count: string; errors: string }>(
    `SELECT tool_name as tool,
            COUNT(*)::int as count,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END)::int as errors
     FROM usage_logs GROUP BY tool_name ORDER BY count DESC`
  );
  const byTool = byToolRes.rows.map((r) => ({
    tool: r.tool,
    count: Number(r.count),
    errors: Number(r.errors),
  }));

  const topUsersRes = await pool.query<{ key: string; count: string }>(
    `SELECT COALESCE(api_key, 'anonymous') as key, COUNT(*)::int as count
     FROM usage_logs GROUP BY api_key ORDER BY count DESC LIMIT 10`
  );
  const topUsers = topUsersRes.rows.map((r) => ({ key: r.key, count: Number(r.count) }));

  const recentRes = await pool.query<{ hour: string; count: string }>(
    `SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') as hour, COUNT(*)::int as count
     FROM usage_logs WHERE created_at >= NOW() - INTERVAL '24 hours'
     GROUP BY date_trunc('hour', created_at) ORDER BY hour`
  );
  const recentHours = recentRes.rows.map((r) => ({ hour: r.hour.trim(), count: Number(r.count) }));

  const recentErrorsRes = await pool.query<{ tool: string; message: string | null; at: string }>(
    `SELECT tool_name as tool, error_message as message,
            to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as at
     FROM usage_logs
     WHERE success = 0 AND created_at >= NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC LIMIT 20`
  );
  const recentErrors = recentErrorsRes.rows.map((r) => ({
    tool: r.tool,
    message: r.message ?? "",
    at: r.at.trim(),
  }));

  const byChain = await getChainStats();
  const byProtocol = await getProtocolStats();
  const byAsset = await getAssetStats();
  const retention = await getRetentionCohort();
  const sessions = await getClientSessions();

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
    recentErrors,
    byChain,
    byProtocol,
    byAsset,
    retention,
    sessions,
  };
}

export async function getChainStats(): Promise<
  Array<{ chain: string; calls: number; clients: number; errors: number }>
> {
  if (!hasDatabase()) return [];
  const res = await getPool().query<{
    chain: string;
    calls: string;
    clients: string;
    errors: string;
  }>(
    `SELECT chain,
            COUNT(*)::int as calls,
            COUNT(DISTINCT api_key)::int as clients,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END)::int as errors
     FROM usage_logs
     WHERE chain IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY chain
     ORDER BY calls DESC`
  );
  return res.rows.map((r) => ({
    chain: r.chain,
    calls: Number(r.calls),
    clients: Number(r.clients),
    errors: Number(r.errors),
  }));
}

export async function getProtocolStats(): Promise<
  Array<{ protocol: string; calls: number; clients: number; errors: number }>
> {
  if (!hasDatabase()) return [];
  const res = await getPool().query<{
    protocol: string;
    calls: string;
    clients: string;
    errors: string;
  }>(
    `SELECT protocol,
            COUNT(*)::int as calls,
            COUNT(DISTINCT api_key)::int as clients,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END)::int as errors
     FROM usage_logs
     WHERE protocol IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY protocol
     ORDER BY calls DESC`
  );
  return res.rows.map((r) => ({
    protocol: r.protocol,
    calls: Number(r.calls),
    clients: Number(r.clients),
    errors: Number(r.errors),
  }));
}

export async function getAssetStats(): Promise<
  Array<{ asset: string; calls: number; clients: number }>
> {
  if (!hasDatabase()) return [];
  const res = await getPool().query<{ asset: string; calls: string; clients: string }>(
    `SELECT asset,
            COUNT(*)::int as calls,
            COUNT(DISTINCT api_key)::int as clients
     FROM usage_logs
     WHERE asset IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
     GROUP BY asset
     ORDER BY calls DESC`
  );
  return res.rows.map((r) => ({
    asset: r.asset,
    calls: Number(r.calls),
    clients: Number(r.clients),
  }));
}

export async function getRetentionCohort(): Promise<{
  returningClients2d: number;
  returningClients7d: number;
  totalClients: number;
}> {
  if (!hasDatabase()) {
    return { returningClients2d: 0, returningClients7d: 0, totalClients: 0 };
  }
  const pool = getPool();
  const totalRes = await pool.query<{ c: string }>(
    `SELECT COUNT(DISTINCT api_key)::int as c
     FROM usage_logs
     WHERE api_key IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'`
  );
  const returning2Res = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::int as c FROM (
       SELECT api_key
       FROM usage_logs
       WHERE api_key IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY api_key
       HAVING COUNT(DISTINCT date_trunc('day', created_at)) >= 2
     ) as t`
  );
  const returning7Res = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::int as c FROM (
       SELECT api_key
       FROM usage_logs
       WHERE api_key IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY api_key
       HAVING COUNT(DISTINCT date_trunc('day', created_at)) >= 7
     ) as t`
  );
  return {
    returningClients2d: Number(returning2Res.rows[0].c),
    returningClients7d: Number(returning7Res.rows[0].c),
    totalClients: Number(totalRes.rows[0].c),
  };
}

interface SessionRow {
  api_key: string;
  tool_name: string;
  created_at: string;
}

export async function getClientSessions(): Promise<
  Array<{ clientKey: string; sessionStart: string; toolSequence: string[]; uniqueTools: number }>
> {
  if (!hasDatabase()) return [];
  const res = await getPool().query<SessionRow>(
    `SELECT api_key, tool_name,
            to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at
     FROM usage_logs
     WHERE api_key IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days'
     ORDER BY api_key, created_at`
  );
  return groupIntoSessions(res.rows).slice(0, 50);
}

function groupIntoSessions(
  rows: SessionRow[]
): Array<{ clientKey: string; sessionStart: string; toolSequence: string[]; uniqueTools: number }> {
  const gapMs = 60 * 60 * 1000;
  const sessions: Array<{
    clientKey: string;
    sessionStart: string;
    startMs: number;
    toolSequence: string[];
  }> = [];
  let current: (typeof sessions)[number] | null = null;
  let lastMs = 0;

  for (const row of rows) {
    const ts = Date.parse(`${row.created_at}Z`);
    const newSession = !current || current.clientKey !== row.api_key || ts - lastMs > gapMs;
    if (newSession) {
      current = {
        clientKey: row.api_key,
        sessionStart: row.created_at,
        startMs: ts,
        toolSequence: [row.tool_name],
      };
      sessions.push(current);
    } else if (current) {
      current.toolSequence.push(row.tool_name);
    }
    lastMs = ts;
  }

  sessions.sort((a, b) => b.startMs - a.startMs);
  return sessions.map((s) => ({
    clientKey: s.clientKey,
    sessionStart: s.sessionStart,
    toolSequence: s.toolSequence,
    uniqueTools: new Set(s.toolSequence).size,
  }));
}
