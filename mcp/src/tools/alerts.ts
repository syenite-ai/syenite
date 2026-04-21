import { isAddress } from "viem";
import {
  addWatch,
  removeWatch,
  listWatches,
  getAlerts,
  acknowledgeAlerts,
  type WatchType,
} from "../data/alerts.js";
import { checkAllWatches } from "../data/alert-checker.js";
import { SyeniteError } from "../errors.js";

export const alertWatchDescription = `Register a continuous monitor that fires alerts when thresholds are crossed. Supports four watch types:

• lending — monitors a wallet address health factor across Aave, Morpho, Spark, Compound. Fires when health factor drops below healthFactorThreshold.
• rate — monitors borrow/supply APY and utilization for a collateral/borrowAsset pair. Fires on APY threshold crossings (rateBorrowThreshold, rateSupplyThreshold) or utilization spikes (rateUtilizationThreshold). Per-market crossing detection — each protocol/chain/market tracked independently.
• carry — monitors the net spread between the best available supply APY for an asset and the cheapest borrow rate for a collateral/borrowAsset pair. Fires when spread exceeds carryThreshold. Replaces manual carry screener polling.
• yield — monitors the best available yield for an asset. Fires when the best matching APY crosses yieldApyThreshold.

Provide webhookUrl to receive POST requests when alerts fire. Otherwise poll alerts.check periodically.`;

export const alertCheckDescription = `Check for active alerts across all watches. Triggers an immediate check before returning.
Returns unacknowledged alerts grouped by severity. Pass acknowledge: true with a watchId to clear alerts after reading.`;

export const alertListDescription = `List all active watches and their status. Shows watch type, parameters, and last check time.`;

export const alertRemoveDescription = `Remove a watch by its ID. Stops monitoring immediately.`;

function validateWebhookUrl(webhookUrl: string): void {
  try {
    const url = new URL(webhookUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("must be http or https");
  } catch {
    throw SyeniteError.invalidInput(
      `Invalid webhookUrl: "${webhookUrl}". Must be a valid HTTP/HTTPS URL.`
    );
  }
}

export async function handleAlertWatch(params: {
  // Common
  type?: WatchType;
  webhookUrl?: string;
  // Lending
  address?: string;
  protocol?: string;
  chain?: string;
  healthFactorThreshold?: number;
  // Rate
  rateCollateral?: string;
  rateBorrowAsset?: string;
  rateChain?: string;
  rateProtocol?: string;
  rateBorrowThreshold?: number;
  rateSupplyThreshold?: number;
  rateDirection?: "above" | "below";
  rateUtilizationThreshold?: number;
  // Carry
  carryCollateral?: string;
  carryBorrowAsset?: string;
  carrySupplyAsset?: string;
  carryThreshold?: number;
  // Yield
  yieldAsset?: string;
  yieldChains?: string[];
  yieldRisk?: "low" | "medium" | "high";
  yieldApyThreshold?: number;
  yieldDirection?: "above" | "below";
}): Promise<Record<string, unknown>> {
  if (params.webhookUrl) validateWebhookUrl(params.webhookUrl);

  const watchType: WatchType = params.type ?? "lending";

  if (watchType === "rate") {
    if (
      params.rateBorrowThreshold === undefined &&
      params.rateSupplyThreshold === undefined &&
      params.rateUtilizationThreshold === undefined
    ) {
      throw SyeniteError.invalidInput(
        "Rate watch requires at least one of rateBorrowThreshold, rateSupplyThreshold, or rateUtilizationThreshold."
      );
    }
    const watch = await addWatch({
      type: "rate",
      address: "n/a",
      healthFactorThreshold: 0,
      rateCollateral: params.rateCollateral,
      rateBorrowAsset: params.rateBorrowAsset,
      rateChain: params.rateChain,
      rateProtocol: params.rateProtocol,
      rateBorrowThreshold: params.rateBorrowThreshold,
      rateSupplyThreshold: params.rateSupplyThreshold,
      rateDirection: params.rateDirection ?? "above",
      rateUtilizationThreshold: params.rateUtilizationThreshold,
      webhookUrl: params.webhookUrl,
    });
    const conditions = [
      params.rateBorrowThreshold !== undefined && `borrow APY ${params.rateDirection ?? "above"} ${params.rateBorrowThreshold}%`,
      params.rateSupplyThreshold !== undefined && `supply APY ${params.rateDirection ?? "above"} ${params.rateSupplyThreshold}%`,
      params.rateUtilizationThreshold !== undefined && `utilization above ${params.rateUtilizationThreshold}%`,
    ].filter(Boolean).join(", ");
    return {
      watch: { id: watch.id, type: watch.type, rateCollateral: watch.rateCollateral,
        rateBorrowAsset: watch.rateBorrowAsset, rateChain: watch.rateChain,
        rateProtocol: watch.rateProtocol, rateBorrowThreshold: watch.rateBorrowThreshold,
        rateSupplyThreshold: watch.rateSupplyThreshold, rateDirection: watch.rateDirection,
        rateUtilizationThreshold: watch.rateUtilizationThreshold,
        webhookUrl: watch.webhookUrl ?? null, createdAt: watch.createdAt },
      message: `Rate watch created. Fires when: ${conditions}.`,
      usage: "Poll alerts.check to retrieve alerts. Use alerts.remove to stop watching.",
    };
  }

  if (watchType === "carry") {
    if (params.carryThreshold === undefined) {
      throw SyeniteError.invalidInput("Carry watch requires carryThreshold (minimum net spread %).");
    }
    const watch = await addWatch({
      type: "carry",
      address: "n/a",
      healthFactorThreshold: 0,
      carryCollateral: params.carryCollateral,
      carryBorrowAsset: params.carryBorrowAsset,
      carrySupplyAsset: params.carrySupplyAsset,
      carryThreshold: params.carryThreshold,
      webhookUrl: params.webhookUrl,
    });
    return {
      watch: { id: watch.id, type: watch.type, carryCollateral: watch.carryCollateral,
        carryBorrowAsset: watch.carryBorrowAsset, carrySupplyAsset: watch.carrySupplyAsset,
        carryThreshold: watch.carryThreshold, webhookUrl: watch.webhookUrl ?? null,
        createdAt: watch.createdAt },
      message: `Carry watch created. Fires when net spread (best supply APY − cheapest borrow APY) exceeds ${params.carryThreshold}%.`,
      usage: "Poll alerts.check to retrieve alerts. Use alerts.remove to stop watching.",
    };
  }

  if (watchType === "yield") {
    if (params.yieldApyThreshold === undefined) {
      throw SyeniteError.invalidInput("Yield watch requires yieldApyThreshold.");
    }
    const watch = await addWatch({
      type: "yield",
      address: "n/a",
      healthFactorThreshold: 0,
      yieldAsset: params.yieldAsset,
      yieldChains: params.yieldChains,
      yieldRisk: params.yieldRisk,
      yieldApyThreshold: params.yieldApyThreshold,
      yieldDirection: params.yieldDirection ?? "above",
      webhookUrl: params.webhookUrl,
    });
    return {
      watch: { id: watch.id, type: watch.type, yieldAsset: watch.yieldAsset,
        yieldChains: watch.yieldChains, yieldRisk: watch.yieldRisk,
        yieldApyThreshold: watch.yieldApyThreshold, yieldDirection: watch.yieldDirection,
        webhookUrl: watch.webhookUrl ?? null, createdAt: watch.createdAt },
      message: `Yield watch created. Fires when best ${params.yieldAsset ?? "any"} APY goes ${params.yieldDirection ?? "above"} ${params.yieldApyThreshold}%.`,
      usage: "Poll alerts.check to retrieve alerts. Use alerts.remove to stop watching.",
    };
  }

  // Default: lending (health factor)
  if (!params.address || !isAddress(params.address)) {
    throw SyeniteError.invalidInput(
      `Lending watch requires a valid EVM address. Got: "${params.address ?? ""}".`
    );
  }
  const watch = await addWatch({
    type: "lending",
    address: params.address,
    protocol: params.protocol,
    chain: params.chain,
    healthFactorThreshold: params.healthFactorThreshold ?? 1.5,
    webhookUrl: params.webhookUrl,
  });
  const webhookNote = watch.webhookUrl ? ` Webhook alerts will POST to ${watch.webhookUrl}.` : "";
  return {
    watch: { id: watch.id, type: watch.type, address: watch.address,
      protocol: watch.protocol, chain: watch.chain,
      healthFactorThreshold: watch.healthFactorThreshold,
      webhookUrl: watch.webhookUrl ?? null, createdAt: watch.createdAt },
    message: `Now watching ${params.address}. Alerts fire when health factor drops below ${watch.healthFactorThreshold}.${webhookNote}`,
    usage: "Poll alerts.check to retrieve alerts. Use alerts.remove to stop watching.",
  };
}

export async function handleAlertCheck(params: {
  watchId?: string;
  acknowledge?: boolean;
}): Promise<Record<string, unknown>> {
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
      type: w.type,
      address: w.type === "lending" ? w.address : undefined,
      protocol: w.protocol ?? (w.type === "prediction" ? "polymarket" : undefined),
      chain: w.chain ?? (w.type === "prediction" ? "polygon" : undefined),
      healthFactorThreshold: w.type === "lending" ? w.healthFactorThreshold : undefined,
      // Rate fields
      rateCollateral: w.rateCollateral,
      rateBorrowAsset: w.rateBorrowAsset,
      rateChain: w.rateChain,
      rateBorrowThreshold: w.rateBorrowThreshold,
      rateSupplyThreshold: w.rateSupplyThreshold,
      rateDirection: w.rateDirection,
      rateUtilizationThreshold: w.rateUtilizationThreshold,
      carryCollateral: w.carryCollateral,
      carryBorrowAsset: w.carryBorrowAsset,
      carrySupplyAsset: w.carrySupplyAsset,
      carryThreshold: w.carryThreshold,
      // Yield fields
      yieldAsset: w.yieldAsset,
      yieldChains: w.yieldChains,
      yieldRisk: w.yieldRisk,
      yieldApyThreshold: w.yieldApyThreshold,
      yieldDirection: w.yieldDirection,
      // Prediction fields
      question: w.question,
      slug: w.slug,
      conditions: w.predictionConditions,
      createdAt: w.createdAt,
      lastCheckedAt: w.lastCheckedAt ?? "never",
    })),
    timestamp: new Date().toISOString(),
  };
}

export async function handleAlertRemove(params: {
  watchId: string;
}): Promise<Record<string, unknown>> {
  const removed = await removeWatch(params.watchId);

  return {
    success: removed,
    message: removed
      ? `Watch ${params.watchId} removed.`
      : `Watch ${params.watchId} not found.`,
  };
}
