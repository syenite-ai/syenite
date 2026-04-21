import { log } from "../logging/logger.js";
import { getPool, hasDatabase } from "./db.js";

export type WatchType = "lending" | "prediction" | "rate" | "yield" | "carry";

export interface PredictionConditions {
  oddsThresholdPct?: number;
  oddsMovePct?: { delta: number; windowMinutes: number };
  liquidityDropPct?: number;
  resolutionApproachingHours?: number;
  volumeSpikeMultiple?: number;
}

export interface PredictionWatchState {
  lastOddsPct?: number;
  lastOddsAt?: string;
  baselineLiquidity?: number;
  baselineVolume24h?: number;
}

// keyed by "${protocol}:${chain}:${market}"
export type RateMarketSnapshot = Record<string, { borrowAPY: number; supplyAPY: number; utilization: number }>;

export interface RateWatchState {
  markets?: RateMarketSnapshot;
  lastCheckedAt?: string;
}

export interface CarryWatchState {
  lastSpread?: number;
  lastCheckedAt?: string;
}

export interface YieldWatchState {
  lastBestApy?: number;
  lastCheckedAt?: string;
}

export interface WatchConfig {
  id: string;
  type: WatchType;
  // lending/prediction watches use address; rate/yield/carry use placeholder "n/a"
  address: string;
  protocol?: string;
  chain?: string;
  // not used for non-lending types (stored as 0 to satisfy the required field)
  healthFactorThreshold: number;
  // Prediction-specific fields (populated when type === "prediction"):
  marketId?: string;
  conditionId?: string;
  slug?: string;
  tokenId?: string;
  outcome?: string;
  question?: string;
  predictionConditions?: PredictionConditions;
  predictionState?: PredictionWatchState;
  // Rate-specific fields (populated when type === "rate"):
  rateCollateral?: string;
  rateBorrowAsset?: string;
  rateChain?: string;
  rateProtocol?: string;
  rateBorrowThreshold?: number;
  rateSupplyThreshold?: number;
  rateDirection?: "above" | "below";
  rateUtilizationThreshold?: number;
  rateState?: RateWatchState;
  // Carry-specific fields (populated when type === "carry"):
  carryCollateral?: string;
  carryBorrowAsset?: string;
  carrySupplyAsset?: string;
  carryThreshold?: number;
  carryState?: CarryWatchState;
  // Yield-specific fields (populated when type === "yield"):
  yieldAsset?: string;
  yieldChains?: string[];
  yieldRisk?: "low" | "medium" | "high";
  yieldApyThreshold?: number;
  yieldDirection?: "above" | "below";
  yieldState?: YieldWatchState;
  webhookUrl?: string;
  createdAt: string;
  lastCheckedAt?: string;
}

export interface Alert {
  watchId: string;
  type:
    | "health_factor_low"
    | "health_factor_critical"
    | "rate_spike"
    | "rate_utilization"
    | "carry_opportunity"
    | "yield_opportunity"
    | "prediction_odds_threshold"
    | "prediction_odds_move"
    | "prediction_liquidity_drop"
    | "prediction_resolution_approaching"
    | "prediction_volume_spike";
  severity: "warning" | "critical";
  message: string;
  data: Record<string, unknown>;
  createdAt: string;
  acknowledged: boolean;
  webhookDelivered?: boolean;
}

// In-memory store — write-through to DB when available
const watches = new Map<string, WatchConfig>();
const alerts: Alert[] = [];
let nextId = 1;

async function persistWatch(watch: WatchConfig): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await getPool().query(
      `INSERT INTO watches (id, config, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config`,
      [watch.id, JSON.stringify(watch), watch.createdAt]
    );
  } catch (e) {
    log.warn("failed to persist watch", { id: watch.id, error: e instanceof Error ? e.message : String(e) });
  }
}

async function deletePersistedWatch(id: string): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await getPool().query("DELETE FROM watches WHERE id = $1", [id]);
  } catch (e) {
    log.warn("failed to delete watch from db", { id, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function loadWatches(): Promise<void> {
  if (!hasDatabase()) return;
  try {
    const res = await getPool().query<{ id: string; config: WatchConfig }>(
      "SELECT id, config FROM watches ORDER BY created_at"
    );
    let maxId = 0;
    for (const row of res.rows) {
      const w = row.config as WatchConfig;
      watches.set(w.id, w);
      const n = parseInt(w.id.replace("watch_", ""), 10);
      if (!isNaN(n) && n > maxId) maxId = n;
    }
    nextId = maxId + 1;
    log.info("watches loaded from db", { count: res.rows.length });
  } catch (e) {
    log.warn("failed to load watches from db", { error: e instanceof Error ? e.message : String(e) });
  }
}

export async function addWatch(
  config: Omit<WatchConfig, "id" | "createdAt" | "type"> & { type?: WatchType }
): Promise<WatchConfig> {
  const id = `watch_${nextId++}`;
  const watch: WatchConfig = {
    type: "lending",
    ...config,
    id,
    createdAt: new Date().toISOString(),
  };
  watches.set(id, watch);
  log.info("watch added", { id, type: watch.type, webhook: !!config.webhookUrl });
  await persistWatch(watch);
  return watch;
}

export async function removeWatch(id: string): Promise<boolean> {
  const existed = watches.delete(id);
  if (existed) {
    log.info("watch removed", { id });
    await deletePersistedWatch(id);
  }
  return existed;
}

export function listWatches(type?: WatchType): WatchConfig[] {
  const all = Array.from(watches.values());
  return type ? all.filter((w) => w.type === type) : all;
}

export function getWatch(id: string): WatchConfig | undefined {
  return watches.get(id);
}

export function updateWatchState(id: string, state: Partial<WatchConfig>): void {
  const current = watches.get(id);
  if (!current) return;
  const updated = { ...current, ...state };
  watches.set(id, updated);
  // Fire-and-forget state update — non-critical, don't await
  void persistWatch(updated);
}

export function addAlert(alert: Omit<Alert, "createdAt" | "acknowledged">): Alert {
  const entry: Alert = {
    ...alert,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };
  alerts.push(entry);
  if (alerts.length > 100) alerts.splice(0, alerts.length - 100);
  return entry;
}

export function getAlerts(watchId?: string, unacknowledgedOnly = false): Alert[] {
  return alerts.filter((a) => {
    if (watchId && a.watchId !== watchId) return false;
    if (unacknowledgedOnly && a.acknowledged) return false;
    return true;
  });
}

export function clearAll(): void {
  watches.clear();
  alerts.length = 0;
  nextId = 1;
}

export function acknowledgeAlerts(watchId: string): number {
  let count = 0;
  for (const alert of alerts) {
    if (alert.watchId === watchId && !alert.acknowledged) {
      alert.acknowledged = true;
      count++;
    }
  }
  return count;
}
