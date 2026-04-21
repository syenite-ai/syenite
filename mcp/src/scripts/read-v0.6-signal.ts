import "dotenv/config";
import { getPool, hasDatabase, closePool } from "../data/db.js";
import { dashboardHtml } from "../web/dashboard.js";
import { getUsageStats, type UsageStats } from "../logging/usage.js";

type Verdict = "pass" | "kill" | "inconclusive";

interface TrackReport {
  track: string;
  verdict: Verdict;
  reason: string;
  metrics: Record<string, number | string>;
}

async function trackASolana(): Promise<TrackReport> {
  const pool = getPool();
  const totals = await pool.query<{ calls: string; clients: string; days: string }>(
    `SELECT COUNT(*)::int as calls,
            COUNT(DISTINCT api_key)::int as clients,
            COUNT(DISTINCT date_trunc('day', created_at))::int as days
     FROM usage_logs
     WHERE chain = 'solana' AND created_at >= NOW() - INTERVAL '30 days'`
  );
  const row = totals.rows[0];
  const calls = Number(row.calls);
  const clients = Number(row.clients);
  const days = Number(row.days);
  const pass = clients >= 3 && days >= 2 && calls >= 50;
  return {
    track: "A — Solana discovery",
    verdict: calls === 0 ? "inconclusive" : pass ? "pass" : "kill",
    reason:
      calls === 0
        ? "No Solana-tagged calls recorded. Either Solana tools not yet shipped or chain column not populated."
        : pass
          ? "Met: >=3 clients across >=2 days and >=50 calls."
          : `Missed: clients=${clients} (need >=3), days=${days} (need >=2), calls=${calls} (need >=50).`,
    metrics: { calls, clients, days },
  };
}

async function trackBMorphoPendle(): Promise<TrackReport> {
  const pool = getPool();
  const morpho = await pool.query<{ total: string; multichain: string }>(
    `SELECT COUNT(*)::int as total,
            SUM(CASE WHEN chain IS NOT NULL AND chain <> 'ethereum' THEN 1 ELSE 0 END)::int as multichain
     FROM usage_logs
     WHERE protocol = 'morpho' AND created_at >= NOW() - INTERVAL '30 days'`
  );
  const pendle = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::int as c
     FROM usage_logs
     WHERE (protocol = 'pendle' OR tool_name LIKE '%pendle%')
       AND created_at >= NOW() - INTERVAL '30 days'`
  );
  const morphoTotal = Number(morpho.rows[0].total);
  const morphoMulti = Number(morpho.rows[0].multichain);
  const pendleCalls = Number(pendle.rows[0].c);
  const morphoRatio = morphoTotal > 0 ? morphoMulti / morphoTotal : 0;
  if (morphoTotal === 0 && pendleCalls === 0) {
    return {
      track: "B — Morpho/Pendle",
      verdict: "inconclusive",
      reason: "No Morpho or Pendle calls tagged in the window.",
      metrics: { morphoTotal, morphoMulti, pendleCalls },
    };
  }
  const pass = morphoRatio >= 0.3 && pendleCalls >= 10;
  return {
    track: "B — Morpho/Pendle",
    verdict: pass ? "pass" : "kill",
    reason: pass
      ? "Met: Morpho multi-chain >=30% and Pendle PT appearances >=10."
      : `Missed: morphoMultiRatio=${morphoRatio.toFixed(2)} (need >=0.30), pendleCalls=${pendleCalls} (need >=10).`,
    metrics: {
      morphoTotal,
      morphoMulti,
      morphoMultiRatio: Math.round(morphoRatio * 1000) / 1000,
      pendleCalls,
    },
  };
}

async function trackCPrediction(): Promise<TrackReport> {
  const pool = getPool();
  const watchRes = await pool.query<{ c: string }>(
    `SELECT COUNT(DISTINCT api_key)::int as c
     FROM usage_logs
     WHERE tool_name = 'prediction.watch' AND created_at >= NOW() - INTERVAL '30 days'`
  );
  const firedRes = await pool.query<{ c: string }>(
    `SELECT COUNT(DISTINCT api_key)::int as c
     FROM usage_logs
     WHERE tool_name = 'alerts.check'
       AND success = 1
       AND created_at >= NOW() - INTERVAL '30 days'`
  );
  const watchClients = Number(watchRes.rows[0].c);
  const firedClients = Number(firedRes.rows[0].c);
  if (watchClients === 0 && firedClients === 0) {
    return {
      track: "C — Prediction loop",
      verdict: "inconclusive",
      reason: "No prediction.watch calls and no alerts.check activity in 30d.",
      metrics: { watchClients, firedClients },
    };
  }
  const pass = watchClients >= 3 && firedClients >= 1;
  return {
    track: "C — Prediction loop",
    verdict: pass ? "pass" : "kill",
    reason: pass
      ? "Met: >=3 distinct clients set prediction.watch; >=1 alerts.check firing."
      : `Missed: watchClients=${watchClients} (need >=3), firedClients=${firedClients} (need >=1).`,
    metrics: { watchClients, firedClients },
  };
}

function trackETelemetry(): TrackReport {
  const required = ["by chain", "by protocol", "retention", "recent sessions"];
  const stub: UsageStats = {
    totalCalls: 0,
    todayCalls: 0,
    weekCalls: 0,
    uniqueClients: 0,
    avgResponseMs: 0,
    errorRate: 0,
    byTool: [],
    topUsers: [],
    recentHours: [],
    recentErrors: [],
    byChain: [],
    byProtocol: [],
    byAsset: [],
    retention: { returningClients2d: 0, returningClients7d: 0, totalClients: 0 },
    sessions: [],
  };
  const html = dashboardHtml(stub);
  const missing = required.filter((s) => !html.toLowerCase().includes(s));
  const pass = missing.length === 0;
  return {
    track: "E — Telemetry",
    verdict: pass ? "pass" : "kill",
    reason: pass
      ? "Dashboard renders all four v0.6 sections (by chain, by protocol, retention, recent sessions)."
      : `Missing dashboard sections: ${missing.join(", ")}.`,
    metrics: { sectionsExpected: required.length, sectionsMissing: missing.length },
  };
}

async function buildReport(): Promise<{
  generatedAt: string;
  verdicts: TrackReport[];
  summary: { pass: number; kill: number; inconclusive: number };
  stats?: Awaited<ReturnType<typeof getUsageStats>>;
}> {
  const verdicts: TrackReport[] = [];
  if (!hasDatabase()) {
    verdicts.push(
      { track: "A — Solana discovery", verdict: "inconclusive", reason: "DATABASE_URL not set.", metrics: {} },
      { track: "B — Morpho/Pendle", verdict: "inconclusive", reason: "DATABASE_URL not set.", metrics: {} },
      { track: "C — Prediction loop", verdict: "inconclusive", reason: "DATABASE_URL not set.", metrics: {} }
    );
    verdicts.push(trackETelemetry());
  } else {
    verdicts.push(await trackASolana());
    verdicts.push(await trackBMorphoPendle());
    verdicts.push(await trackCPrediction());
    verdicts.push(trackETelemetry());
  }

  const summary = { pass: 0, kill: 0, inconclusive: 0 };
  for (const v of verdicts) summary[v.verdict] += 1;

  const report: Awaited<ReturnType<typeof buildReport>> = {
    generatedAt: new Date().toISOString(),
    verdicts,
    summary,
  };
  if (hasDatabase()) {
    report.stats = await getUsageStats();
  }
  return report;
}

async function main() {
  const report = await buildReport();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  await closePool().catch(() => undefined);
}

main().catch(async (e) => {
  console.error("Signal read failed:", e instanceof Error ? e.message : e);
  await closePool().catch(() => undefined);
  process.exit(1);
});
