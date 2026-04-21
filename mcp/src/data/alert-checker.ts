import { type Address } from "viem";
import { getAavePosition, getSparkPosition } from "./aave.js";
import { getMorphoPosition } from "./morpho.js";
import { getCompoundPosition } from "./compound.js";
import {
  listWatches,
  addAlert,
  getWatch,
  updateWatchState,
  type WatchConfig,
  type Alert,
  type PredictionConditions,
  type PredictionWatchState,
} from "./alerts.js";
import { getMarketDetail, getOrderBook } from "./polymarket.js";
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

async function checkLendingWatch(watch: WatchConfig): Promise<Alert[]> {
  const fired: Alert[] = [];
  const positions = await checkPosition(
    watch.address as Address,
    watch.protocol,
    watch.chain
  );

  for (const pos of positions) {
    if (pos.healthFactor === Infinity) continue;

    if (pos.healthFactor < 1.1) {
      fired.push(addAlert({
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
      }));
    } else if (pos.healthFactor < watch.healthFactorThreshold) {
      fired.push(addAlert({
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
      }));
    }
  }
  return fired;
}

interface PredictionEval {
  oddsPct: number;
  volume24h: number;
  liquidity: number;
  endDate?: string;
  tokenId: string;
  question: string;
}

async function evaluatePredictionMarket(watch: WatchConfig): Promise<PredictionEval | null> {
  const identifier = watch.slug ?? watch.conditionId ?? watch.marketId;
  if (!identifier) return null;

  const market = await getMarketDetail(identifier);
  if (!market) return null;

  const tokenId = watch.tokenId ?? market.clobTokenIds?.[0];
  if (!tokenId) return null;

  let oddsPct = Number(market.outcomePrices[0] ?? market.lastTradePrice) * 100;
  const book = await getOrderBook(tokenId);
  if (book && Number.isFinite(book.midPrice)) oddsPct = book.midPrice * 100;

  return {
    oddsPct,
    volume24h: market.volume24hr ?? 0,
    liquidity: market.liquidity,
    endDate: market.endDate,
    tokenId,
    question: market.question,
  };
}

function evalPredictionTriggers(
  watch: WatchConfig,
  state: PredictionWatchState,
  evalData: PredictionEval
): Array<Omit<Alert, "createdAt" | "acknowledged">> {
  const c: PredictionConditions = watch.predictionConditions ?? {};
  const triggered: Array<Omit<Alert, "createdAt" | "acknowledged">> = [];

  if (c.oddsThresholdPct !== undefined && evalData.oddsPct >= c.oddsThresholdPct) {
    triggered.push({
      watchId: watch.id,
      type: "prediction_odds_threshold",
      severity: "warning",
      message: `Odds ${evalData.oddsPct.toFixed(1)}% crossed threshold ${c.oddsThresholdPct}% on "${evalData.question}"`,
      data: {
        marketId: watch.marketId, question: evalData.question,
        triggerType: "odds", currentValue: evalData.oddsPct, threshold: c.oddsThresholdPct,
      },
    });
  }

  if (c.oddsMovePct && state.lastOddsPct !== undefined && state.lastOddsAt) {
    const minutesElapsed = (Date.now() - new Date(state.lastOddsAt).getTime()) / 60_000;
    if (minutesElapsed <= c.oddsMovePct.windowMinutes) {
      const move = Math.abs(evalData.oddsPct - state.lastOddsPct);
      if (move >= c.oddsMovePct.delta) {
        triggered.push({
          watchId: watch.id,
          type: "prediction_odds_move",
          severity: "warning",
          message: `Odds moved ${move.toFixed(1)}pp in ${minutesElapsed.toFixed(0)}m (${state.lastOddsPct.toFixed(1)}% → ${evalData.oddsPct.toFixed(1)}%)`,
          data: {
            marketId: watch.marketId, question: evalData.question, triggerType: "movement",
            previousValue: state.lastOddsPct, currentValue: evalData.oddsPct, move, windowMinutes: minutesElapsed,
          },
        });
      }
    }
  }

  if (c.liquidityDropPct !== undefined && state.baselineLiquidity !== undefined && state.baselineLiquidity > 0) {
    const dropPct = ((state.baselineLiquidity - evalData.liquidity) / state.baselineLiquidity) * 100;
    if (dropPct >= c.liquidityDropPct) {
      triggered.push({
        watchId: watch.id,
        type: "prediction_liquidity_drop",
        severity: "warning",
        message: `Liquidity dropped ${dropPct.toFixed(1)}% on "${evalData.question}"`,
        data: {
          marketId: watch.marketId, question: evalData.question, triggerType: "liquidity",
          previousValue: state.baselineLiquidity, currentValue: evalData.liquidity, dropPct,
        },
      });
    }
  }

  if (c.resolutionApproachingHours !== undefined && evalData.endDate) {
    const hoursToResolve = (new Date(evalData.endDate).getTime() - Date.now()) / 3_600_000;
    if (hoursToResolve > 0 && hoursToResolve <= c.resolutionApproachingHours) {
      triggered.push({
        watchId: watch.id,
        type: "prediction_resolution_approaching",
        severity: hoursToResolve < 1 ? "critical" : "warning",
        message: `Market resolves in ${hoursToResolve.toFixed(1)}h: "${evalData.question}"`,
        data: {
          marketId: watch.marketId, question: evalData.question, triggerType: "resolution",
          hoursToResolve, endDate: evalData.endDate,
        },
      });
    }
  }

  if (c.volumeSpikeMultiple !== undefined && state.baselineVolume24h !== undefined && state.baselineVolume24h > 0) {
    const ratio = evalData.volume24h / state.baselineVolume24h;
    if (ratio >= c.volumeSpikeMultiple) {
      triggered.push({
        watchId: watch.id,
        type: "prediction_volume_spike",
        severity: "warning",
        message: `Volume 24h spiked ${ratio.toFixed(1)}x baseline on "${evalData.question}"`,
        data: {
          marketId: watch.marketId, question: evalData.question, triggerType: "volume",
          previousValue: state.baselineVolume24h, currentValue: evalData.volume24h, multiple: ratio,
        },
      });
    }
  }

  return triggered;
}

async function checkPredictionWatch(watch: WatchConfig): Promise<Alert[]> {
  const evalData = await evaluatePredictionMarket(watch);
  if (!evalData) return [];

  const state = watch.predictionState ?? {};
  const triggers = evalPredictionTriggers(watch, state, evalData);

  const fired: Alert[] = [];
  for (const t of triggers) fired.push(addAlert(t));

  updateWatchState(watch.id, {
    predictionState: {
      lastOddsPct: evalData.oddsPct,
      lastOddsAt: new Date().toISOString(),
      baselineLiquidity: state.baselineLiquidity ?? evalData.liquidity,
      baselineVolume24h: state.baselineVolume24h ?? evalData.volume24h,
    },
  });
  return fired;
}

async function runCheck(): Promise<void> {
  const watches = listWatches();
  if (watches.length === 0) return;

  for (const watch of watches) {
    try {
      const fired = watch.type === "prediction"
        ? await checkPredictionWatch(watch)
        : await checkLendingWatch(watch);

      if (watch.webhookUrl && fired.length > 0) {
        for (const alert of fired) {
          await deliverWebhook(watch.webhookUrl, alert);
        }
      }

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
