import { getPool } from "../data/db.js";
import { getClient } from "../data/client.js";

export async function getHealthStatus(): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  checks: Record<string, { ok: boolean; message: string; latencyMs?: number }>;
  uptime: number;
}> {
  const startTime = process.uptime();
  const checks: Record<string, { ok: boolean; message: string; latencyMs?: number }> = {};

  // Database check
  try {
    await getPool().query("SELECT 1");
    checks.database = { ok: true, message: "Postgres connected" };
  } catch (e) {
    checks.database = {
      ok: false,
      message: `Postgres error: ${e instanceof Error ? e.message : "unknown"}`,
    };
  }

  // RPC check
  try {
    const rpcStart = Date.now();
    const client = getClient();
    const blockNumber = await client.getBlockNumber();
    const rpcLatency = Date.now() - rpcStart;
    checks.rpc = {
      ok: true,
      message: `Alchemy connected, block ${blockNumber}`,
      latencyMs: rpcLatency,
    };
  } catch (e) {
    checks.rpc = {
      ok: false,
      message: `RPC error: ${e instanceof Error ? e.message : "unknown"}`,
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  const anyOk = Object.values(checks).some((c) => c.ok);

  return {
    status: allOk ? "healthy" : anyOk ? "degraded" : "unhealthy",
    checks,
    uptime: Math.round(startTime),
  };
}
