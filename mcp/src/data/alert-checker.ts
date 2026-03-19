import { type Address } from "viem";
import { getAavePosition, getSparkPosition } from "./aave.js";
import { getMorphoPosition } from "./morpho.js";
import { getCompoundPosition } from "./compound.js";
import { listWatches, addAlert, getWatch, type Alert } from "./alerts.js";
import { deliverWebhook } from "./webhook.js";
import { log } from "../logging/logger.js";
import type { SupportedChain } from "./client.js";
import type { PositionData } from "./types.js";

let checkInterval: ReturnType<typeof setInterval> | null = null;

async function checkPosition(address: Address, protocol?: string, chain?: string): Promise<PositionData[]> {
  const chains = chain && chain !== "all" ? [chain as SupportedChain] : undefined;
  const promises: Promise<PositionData[]>[] = [];

  if (!protocol || protocol === "aave-v3" || protocol === "aave" || protocol === "all") {
    promises.push(getAavePosition(address, undefined, chains));
  }
  if (!protocol || protocol === "morpho" || protocol === "all") {
    promises.push(getMorphoPosition(address));
  }
  if (!protocol || protocol === "spark" || protocol === "all") {
    promises.push(getSparkPosition(address, undefined, chains));
  }
  if (!protocol || protocol === "compound-v3" || protocol === "compound" || protocol === "all") {
    promises.push(getCompoundPosition(address, undefined, chains));
  }

  const results = await Promise.allSettled(promises);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function runCheck(): Promise<void> {
  const watches = listWatches();
  if (watches.length === 0) return;

  for (const watch of watches) {
    try {
      const positions = await checkPosition(
        watch.address as Address,
        watch.protocol,
        watch.chain
      );

      for (const pos of positions) {
        if (pos.healthFactor === Infinity) continue;

        let alertPayload: Omit<Alert, "createdAt" | "acknowledged"> | null = null;

        if (pos.healthFactor < 1.1) {
          alertPayload = {
            watchId: watch.id,
            type: "health_factor_critical",
            severity: "critical",
            message: `CRITICAL: ${pos.market} health factor at ${pos.healthFactor.toFixed(2)} — liquidation imminent`,
            data: {
              protocol: pos.protocol,
              market: pos.market,
              healthFactor: pos.healthFactor,
              currentLTV: pos.currentLTV,
              liquidationPrice: pos.liquidationPrice,
              distanceToLiquidation: pos.distanceToLiquidation,
            },
          };
        } else if (pos.healthFactor < watch.healthFactorThreshold) {
          alertPayload = {
            watchId: watch.id,
            type: "health_factor_low",
            severity: "warning",
            message: `${pos.market} health factor ${pos.healthFactor.toFixed(2)} below threshold ${watch.healthFactorThreshold}`,
            data: {
              protocol: pos.protocol,
              market: pos.market,
              healthFactor: pos.healthFactor,
              currentLTV: pos.currentLTV,
              liquidationPrice: pos.liquidationPrice,
              distanceToLiquidation: pos.distanceToLiquidation,
            },
          };
        }

        if (alertPayload) {
          addAlert(alertPayload);
          if (watch.webhookUrl) {
            deliverWebhook(watch.webhookUrl, alertPayload).catch((err) => {
              log.warn("webhook delivery failed", {
                watchId: watch.id,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          }
        }
      }

      // Update last check time
      const current = getWatch(watch.id);
      if (current) current.lastCheckedAt = new Date().toISOString();
    } catch (e) {
      log.warn("alert check failed for watch", {
        watchId: watch.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

export function startAlertChecker(intervalMs: number = 60_000): void {
  if (checkInterval) return;

  checkInterval = setInterval(async () => {
    try {
      await runCheck();
    } catch (e) {
      log.warn("alert checker run failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, intervalMs);

  log.info("alert checker started", { intervalMs });
}

export function stopAlertChecker(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

export { runCheck as checkAllWatches };
