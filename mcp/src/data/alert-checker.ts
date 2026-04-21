import { type Address } from "viem";
import { getAavePosition, getSparkPosition, getAaveRates, getSparkRates } from "./aave.js";
import { getMorphoPosition, getMorphoRatesMultiChain } from "./morpho.js";
import { getCompoundPosition, getCompoundRates } from "./compound.js";
import { getFluidRates } from "./fluid.js";
import { getLendingSupplyYields } from "./yield-lending.js";
import { getStakingYields } from "./yield-staking.js";
import { getVaultYields } from "./yield-vaults.js";
import { getMetaMorphoYields } from "./yield-metamorpho.js";
import { getSolanaYields } from "./solana/yield.js";
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
import type { PositionData, ProtocolRate, YieldOpportunity } from "./types.js";

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

async function fetchRates(
  collateral: string,
  borrowAsset: string,
  chains?: SupportedChain[],
  protocol?: string
): Promise<ProtocolRate[]> {
  const all = protocol && protocol !== "all" ? [protocol] : ["aave", "morpho", "spark", "compound", "fluid"];
  const tasks: Promise<ProtocolRate[]>[] = [];
  if (all.includes("aave") || all.includes("aave-v3")) tasks.push(getAaveRates(collateral, borrowAsset, chains));
  if (all.includes("morpho")) tasks.push(getMorphoRatesMultiChain(collateral, borrowAsset, chains));
  if (all.includes("spark")) tasks.push(getSparkRates(collateral, borrowAsset, chains));
  if (all.includes("compound") || all.includes("compound-v3")) tasks.push(getCompoundRates(collateral, borrowAsset, chains));
  if (all.includes("fluid")) tasks.push(getFluidRates(collateral, borrowAsset, chains));
  const results = await Promise.allSettled(tasks);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

function marketKey(r: ProtocolRate): string {
  return `${r.protocol}:${r.chain}:${r.market}`;
}

async function checkRateWatch(watch: WatchConfig): Promise<Alert[]> {
  const collateral = watch.rateCollateral ?? "all";
  const borrowAsset = watch.rateBorrowAsset ?? "USDC";
  const chains = watch.rateChain && watch.rateChain !== "all"
    ? [watch.rateChain as SupportedChain]
    : undefined;

  const rates = await fetchRates(collateral, borrowAsset, chains, watch.rateProtocol);
  if (rates.length === 0) return [];

  const fired: Alert[] = [];
  const direction = watch.rateDirection ?? "above";
  const prevMarkets = watch.rateState?.markets ?? {};
  const nextMarkets: typeof prevMarkets = {};

  for (const rate of rates) {
    const key = marketKey(rate);
    const prev = prevMarkets[key];

    // Rate threshold checks (borrow and supply independently)
    for (const [metric, threshold] of [
      ["borrowAPY", watch.rateBorrowThreshold] as const,
      ["supplyAPY", watch.rateSupplyThreshold] as const,
    ]) {
      if (threshold === undefined) continue;
      const current = metric === "borrowAPY" ? rate.borrowAPY : rate.supplyAPY;
      const prevVal = metric === "borrowAPY" ? prev?.borrowAPY : prev?.supplyAPY;
      const crossed = direction === "above" ? current >= threshold : current <= threshold;
      const wasCrossed = prevVal !== undefined
        ? (direction === "above" ? prevVal >= threshold : prevVal <= threshold)
        : false;
      if (crossed && !wasCrossed) {
        fired.push(addAlert({
          watchId: watch.id,
          type: "rate_spike",
          severity: direction === "above" ? "warning" : "warning",
          message: `${rate.protocol} ${rate.chain} ${rate.market} ${metric} ${direction} ${threshold}%: now ${current.toFixed(2)}%`,
          data: { protocol: rate.protocol, chain: rate.chain, market: rate.market,
            metric, currentValue: current, previousValue: prevVal, threshold, direction },
        }));
      }
    }

    // Utilization threshold check
    if (watch.rateUtilizationThreshold !== undefined) {
      const prevUtil = prev?.utilization;
      const crossed = rate.utilization >= watch.rateUtilizationThreshold;
      const wasCrossed = prevUtil !== undefined && prevUtil >= watch.rateUtilizationThreshold;
      if (crossed && !wasCrossed) {
        fired.push(addAlert({
          watchId: watch.id,
          type: "rate_utilization",
          severity: rate.utilization >= 95 ? "critical" : "warning",
          message: `${rate.protocol} ${rate.chain} ${rate.market} utilization at ${rate.utilization.toFixed(1)}% — borrow rate kink approaching`,
          data: { protocol: rate.protocol, chain: rate.chain, market: rate.market,
            utilization: rate.utilization, threshold: watch.rateUtilizationThreshold,
            borrowAPY: rate.borrowAPY, availableLiquidityUSD: rate.availableLiquidityUSD },
        }));
      }
    }

    nextMarkets[key] = { borrowAPY: rate.borrowAPY, supplyAPY: rate.supplyAPY, utilization: rate.utilization };
  }

  updateWatchState(watch.id, {
    rateState: { markets: nextMarkets, lastCheckedAt: new Date().toISOString() },
    lastCheckedAt: new Date().toISOString(),
  });

  return fired;
}

async function checkCarryWatch(watch: WatchConfig): Promise<Alert[]> {
  const collateral = watch.carryCollateral ?? "all";
  const borrowAsset = watch.carryBorrowAsset ?? "USDC";
  const supplyAsset = watch.carrySupplyAsset ?? borrowAsset;
  const threshold = watch.carryThreshold ?? 0;

  // Fetch borrow rates for the collateral/borrow pair and supply yields
  const [borrowRates, supplyYields] = await Promise.all([
    fetchRates(collateral, borrowAsset),
    fetchYields(supplyAsset, [], "high"),
  ]);

  if (borrowRates.length === 0 || supplyYields.length === 0) return [];

  const bestBorrow = borrowRates.reduce((a, b) => a.borrowAPY < b.borrowAPY ? a : b);
  supplyYields.sort((a, b) => b.apy - a.apy);
  const bestSupply = supplyYields[0];

  const spread = bestSupply.apy - bestBorrow.borrowAPY;
  const lastSpread = watch.carryState?.lastSpread;
  const wasTriggered = lastSpread !== undefined && lastSpread >= threshold;
  const triggered = spread >= threshold;

  const fired: Alert[] = [];
  if (triggered && !wasTriggered) {
    fired.push(addAlert({
      watchId: watch.id,
      type: "carry_opportunity",
      severity: "warning",
      message: `Carry spread ${spread.toFixed(2)}%: borrow ${borrowAsset} at ${bestBorrow.borrowAPY.toFixed(2)}% (${bestBorrow.protocol} ${bestBorrow.chain}), supply ${supplyAsset} at ${bestSupply.apy.toFixed(2)}% (${bestSupply.protocol})`,
      data: {
        spread,
        threshold,
        borrow: { protocol: bestBorrow.protocol, chain: bestBorrow.chain,
          market: bestBorrow.market, borrowAPY: bestBorrow.borrowAPY },
        supply: { protocol: bestSupply.protocol, product: bestSupply.product,
          asset: bestSupply.asset, supplyAPY: bestSupply.apy, risk: bestSupply.risk },
      },
    }));
  }

  updateWatchState(watch.id, {
    carryState: { lastSpread: spread, lastCheckedAt: new Date().toISOString() },
    lastCheckedAt: new Date().toISOString(),
  });

  return fired;
}

async function fetchYields(
  asset: string,
  chains: string[],
  risk: string
): Promise<YieldOpportunity[]> {
  const RISK_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3 };
  const maxRisk = RISK_ORDER[risk] ?? 3;
  const includeSolana = chains.length === 0 || chains.includes("solana");
  const includeEvm = chains.length === 0 || chains.some((c) => c !== "solana");

  const tasks: Promise<YieldOpportunity[]>[] = [];
  if (includeEvm) {
    tasks.push(
      getLendingSupplyYields(asset),
      getStakingYields(),
      getVaultYields(),
      getMetaMorphoYields(),
    );
  }
  if (includeSolana) tasks.push(getSolanaYields());

  const results = await Promise.allSettled(tasks);
  let all: YieldOpportunity[] = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  if (asset && asset !== "all") {
    const filter = asset.toLowerCase();
    all = all.filter((y) => y.asset.toLowerCase() === filter
      || (filter === "eth" && ["eth", "weth"].includes(y.asset.toLowerCase()))
      || (filter === "stables" && ["usdc", "usdt", "dai", "gho", "usde"].includes(y.asset.toLowerCase()))
    );
  }

  return all.filter((y) => RISK_ORDER[y.risk] <= maxRisk);
}

async function checkYieldWatch(watch: WatchConfig): Promise<Alert[]> {
  const asset = watch.yieldAsset ?? "all";
  const chains = watch.yieldChains ?? [];
  const risk = watch.yieldRisk ?? "high";
  const threshold = watch.yieldApyThreshold;
  if (threshold === undefined) return [];

  const opportunities = await fetchYields(asset, chains, risk);
  if (opportunities.length === 0) return [];

  opportunities.sort((a, b) => b.apy - a.apy);
  const best = opportunities[0];
  const direction = watch.yieldDirection ?? "above";
  const state = watch.yieldState ?? {};
  const lastBest = state.lastBestApy;

  const triggered = direction === "above" ? best.apy >= threshold : best.apy <= threshold;
  const wasTriggered = lastBest !== undefined
    ? (direction === "above" ? lastBest >= threshold : lastBest <= threshold)
    : false;

  const fired: Alert[] = [];
  if (triggered && !wasTriggered) {
    fired.push(addAlert({
      watchId: watch.id,
      type: "yield_opportunity",
      severity: "warning",
      message: `${best.protocol} ${best.product} (${best.asset}) ${direction} ${threshold}% APY: now ${best.apy.toFixed(2)}%`,
      data: {
        protocol: best.protocol,
        product: best.product,
        asset: best.asset,
        currentApy: best.apy,
        threshold,
        direction,
        risk: best.risk,
        tvlUSD: best.tvlUSD,
      },
    }));
  }

  updateWatchState(watch.id, {
    yieldState: { lastBestApy: best.apy, lastCheckedAt: new Date().toISOString() },
    lastCheckedAt: new Date().toISOString(),
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
        : watch.type === "rate"
        ? await checkRateWatch(watch)
        : watch.type === "yield"
        ? await checkYieldWatch(watch)
        : watch.type === "carry"
        ? await checkCarryWatch(watch)
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
