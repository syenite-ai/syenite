import { isAddress } from "viem";
import {
  addWatch,
  removeWatch,
  listWatches,
  getAlerts,
  acknowledgeAlerts,
} from "../data/alerts.js";
import { checkAllWatches } from "../data/alert-checker.js";
import { SyeniteError } from "../errors.js";

export const alertWatchDescription = `Register a lending position for continuous monitoring.
Sets a health factor threshold — when the position drops below it, alerts are generated.
Alerts can be polled via alerts.check. Use this for automated risk management.`;

export const alertCheckDescription = `Check for active alerts on watched positions.
Returns any health factor warnings or critical alerts since last acknowledgment.
Call this periodically to stay informed about position health.`;

export const alertListDescription = `List all active position watches and their status.
Shows watched addresses, thresholds, and last check times.`;

export const alertRemoveDescription = `Remove a position watch by its ID. Stops monitoring that address.`;

export async function handleAlertWatch(params: {
  address: string;
  protocol?: string;
  chain?: string;
  healthFactorThreshold?: number;
}): Promise<Record<string, unknown>> {
  if (!isAddress(params.address)) {
    throw SyeniteError.invalidInput(
      `"${params.address}" is not a valid EVM address.`
    );
  }

  const watch = addWatch({
    address: params.address,
    protocol: params.protocol,
    chain: params.chain,
    healthFactorThreshold: params.healthFactorThreshold ?? 1.5,
  });

  return {
    watch,
    message: `Now watching ${params.address}. Alerts will fire when health factor drops below ${watch.healthFactorThreshold}.`,
    usage: "Poll alerts.check to retrieve alerts. Use alerts.remove to stop watching.",
  };
}

export async function handleAlertCheck(params: {
  watchId?: string;
  acknowledge?: boolean;
}): Promise<Record<string, unknown>> {
  // Trigger an immediate check before returning
  await checkAllWatches();

  const alerts = getAlerts(params.watchId, true);

  if (params.acknowledge && params.watchId) {
    acknowledgeAlerts(params.watchId);
  }

  const critical = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  return {
    alertCount: alerts.length,
    critical: critical.length,
    warnings: warnings.length,
    alerts: alerts.map((a) => ({
      watchId: a.watchId,
      type: a.type,
      severity: a.severity,
      message: a.message,
      data: a.data,
      createdAt: a.createdAt,
    })),
    timestamp: new Date().toISOString(),
  };
}

export async function handleAlertList(): Promise<Record<string, unknown>> {
  const watches = listWatches();

  return {
    watchCount: watches.length,
    watches: watches.map((w) => ({
      id: w.id,
      address: w.address,
      protocol: w.protocol ?? "all",
      chain: w.chain ?? "all",
      healthFactorThreshold: w.healthFactorThreshold,
      createdAt: w.createdAt,
      lastCheckedAt: w.lastCheckedAt ?? "never",
    })),
    timestamp: new Date().toISOString(),
  };
}

export async function handleAlertRemove(params: {
  watchId: string;
}): Promise<Record<string, unknown>> {
  const removed = removeWatch(params.watchId);

  return {
    success: removed,
    message: removed
      ? `Watch ${params.watchId} removed.`
      : `Watch ${params.watchId} not found.`,
  };
}
