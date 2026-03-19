import { log } from "../logging/logger.js";

export interface WatchConfig {
  id: string;
  address: string;
  protocol?: string;
  chain?: string;
  healthFactorThreshold: number;
  createdAt: string;
  lastCheckedAt?: string;
}

export interface Alert {
  watchId: string;
  type: "health_factor_low" | "health_factor_critical" | "rate_spike";
  severity: "warning" | "critical";
  message: string;
  data: Record<string, unknown>;
  createdAt: string;
  acknowledged: boolean;
}

// In-memory alert store (future: persist to DB for server mode)
const watches = new Map<string, WatchConfig>();
const alerts: Alert[] = [];
let nextId = 1;

export function addWatch(config: Omit<WatchConfig, "id" | "createdAt">): WatchConfig {
  const id = `watch_${nextId++}`;
  const watch: WatchConfig = {
    ...config,
    id,
    createdAt: new Date().toISOString(),
  };
  watches.set(id, watch);
  log.info("position watch added", { id, address: config.address });
  return watch;
}

export function removeWatch(id: string): boolean {
  const existed = watches.delete(id);
  if (existed) log.info("position watch removed", { id });
  return existed;
}

export function listWatches(): WatchConfig[] {
  return Array.from(watches.values());
}

export function getWatch(id: string): WatchConfig | undefined {
  return watches.get(id);
}

export function addAlert(alert: Omit<Alert, "createdAt" | "acknowledged">): void {
  alerts.push({
    ...alert,
    createdAt: new Date().toISOString(),
    acknowledged: false,
  });

  // Keep only last 100 alerts
  if (alerts.length > 100) alerts.splice(0, alerts.length - 100);
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
