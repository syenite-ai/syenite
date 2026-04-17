import { log } from "../logging/logger.js";

export type WatchType = "lending" | "prediction";

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

export interface WatchConfig {
  id: string;
  type: WatchType;
  address: string;
  protocol?: string;
  chain?: string;
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

// In-memory alert store (future: persist to DB for server mode)
const watches = new Map<string, WatchConfig>();
const alerts: Alert[] = [];
let nextId = 1;

export function addWatch(
  config: Omit<WatchConfig, "id" | "createdAt" | "type"> & { type?: WatchType }
): WatchConfig {
  const id = `watch_${nextId++}`;
  const watch: WatchConfig = {
    type: "lending",
    ...config,
    id,
    createdAt: new Date().toISOString(),
  };
  watches.set(id, watch);
  log.info("position watch added", { id, type: watch.type, address: config.address, webhook: !!config.webhookUrl });
  return watch;
}

export function removeWatch(id: string): boolean {
  const existed = watches.delete(id);
  if (existed) log.info("position watch removed", { id });
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
  watches.set(id, { ...current, ...state });
}

export function addAlert(alert: Omit<Alert, "createdAt" | "acknowledged">): Alert {
  const entry: Alert = {
    ...alert,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };
  alerts.push(entry);

  // Keep only last 100 alerts
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
