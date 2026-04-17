/**
 * Backtest runner for Strategy 2a: Funding Rate / Basis Capture.
 *
 * Simulates: long spot BTC/ETH + short perp, collecting funding payments.
 * Assumes Hyperliquid perps (hourly funding, applied as daily averages here).
 *
 * Position PnL:
 *   - Spot: tracks price movement (but hedged by perp short, so net ~0)
 *   - Funding: short pays/receives funding rate × position size
 *   - When funding positive: shorts receive (we profit)
 *   - When funding negative: shorts pay (we lose)
 *
 * Costs modeled:
 *   - Trading fees: 0.035% taker per leg (spot + perp = 0.07% round trip)
 *   - No slippage (conservative for BTC/ETH on Hyperliquid)
 *   - Margin: perp short requires margin; we model at 2x leverage (50% of position)
 *
 * Usage: npx tsx src/backtest/run-basis.ts
 */

import { createFundingHistoryModule, type FundingSnapshot } from "../data/funding-history.js";
import { createBasisCapture, type BasisState, type BasisSignal } from "../modules/basis-capture.js";

interface BasisPosition {
  coin: string;
  spotSizeUSD: number;
  perpSizeUSD: number;
  entrySpotPrice: number;
  entryTimestamp: number;
  cumulativeFundingUSD: number;
  cumulativeFeesUSD: number;
}

interface PortfolioState {
  timestamp: number;
  cashUSD: number;
  positions: BasisPosition[];
  totalValueUSD: number;
  cumulativeFundingUSD: number;
  cumulativeFeesUSD: number;
  cumulativePnlUSD: number;
}

interface Config {
  initialCapitalUSD: number;
  tradingFeeBps: number;         // per leg (spot buy + perp short)
  perpLeverage: number;          // leverage on perp side (e.g. 2 = 50% margin)
  coins: string[];
}

const config: Config = {
  initialCapitalUSD: 100_000,
  tradingFeeBps: 3.5,            // Hyperliquid taker fee
  perpLeverage: 2,               // 2x leverage = 50% margin requirement
  coins: ["BTC", "ETH"],
};

function initPortfolio(capitalUSD: number, ts: number): PortfolioState {
  return {
    timestamp: ts,
    cashUSD: capitalUSD,
    positions: [],
    totalValueUSD: capitalUSD,
    cumulativeFundingUSD: 0,
    cumulativeFeesUSD: 0,
    cumulativePnlUSD: 0,
  };
}

function calcPositionValue(pos: BasisPosition, currentSpotPrice: number): number {
  // Delta-neutral: long spot + short perp at equal notional.
  // Spot PnL and perp PnL cancel. Net value = initial size + funding - fees.
  //
  // Spot: spotUnits * currentPrice
  // Perp short PnL: spotSizeUSD - spotUnits * currentPrice  (profit when price drops)
  // Sum: spotUnits * currentPrice + spotSizeUSD - spotUnits * currentPrice = spotSizeUSD
  //
  // So the combined position always marks to spotSizeUSD regardless of price.
  return pos.spotSizeUSD + pos.cumulativeFundingUSD - pos.cumulativeFeesUSD;
}

async function main() {
  const dataModule = createFundingHistoryModule();
  const signalModule = createBasisCapture({
    entryThresholdAnnPct: 8,
    exitThresholdAnnPct: 2,
    maxExposurePct: 0.5,
    lookbackDays: 7,
    persistenceThreshold: 0.7,
    scalingEnabled: true,
  });

  // Backtest period: Jan 2024 onward (new market regime)
  // Note: spot price data only available from 2025-05-12, so PnL reporting
  // for earlier period tracks funding yield without spot benchmarks.
  const startDate = "2024-01-01";
  const endDate = "2026-03-23";
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate).getTime() / 1000);
  const daySeconds = 86400;

  let portfolio = initPortfolio(config.initialCapitalUSD, startTs);
  const signalState: BasisState = {
    positions: new Map(),
    fundingHistory: new Map(),
  };

  const dailyLog: Array<{
    date: string;
    totalValue: number;
    cash: number;
    positions: string;
    funding: number;
    fees: number;
    action: string;
  }> = [];

  let totalEntries = 0;
  let totalExits = 0;
  let daysInPosition = 0;

  for (let ts = startTs; ts <= endTs; ts += daySeconds) {
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    const snapshots = await dataModule.getAt(ts) as FundingSnapshot[];
    if (snapshots.length === 0) continue;

    portfolio.timestamp = ts;

    // Accrue funding on existing positions
    for (const pos of portfolio.positions) {
      const snap = snapshots.find((s) => s.coin === pos.coin);
      if (!snap) continue;

      // Daily funding = hourly rate × 24 × position size
      const dailyFunding = snap.avgFundingRate * 24 * pos.perpSizeUSD;
      pos.cumulativeFundingUSD += dailyFunding;
      portfolio.cumulativeFundingUSD += dailyFunding;
    }

    if (portfolio.positions.length > 0) daysInPosition++;

    // Get signals
    const signals = signalModule.evaluate(snapshots, signalState);
    let actionStr = "hold";

    for (const signal of signals) {
      const snap = snapshots.find((s) => s.coin === signal.coin);
      if (!snap || snap.spotPriceUSD === 0) continue;

      if (signal.action === "enter") {
        const positionSizeUSD = portfolio.totalValueUSD * signal.targetExposurePct;
        const availableCash = portfolio.cashUSD;
        // Need: spot purchase + perp margin
        // spot = positionSizeUSD, perp margin = positionSizeUSD / leverage
        const capitalNeeded = positionSizeUSD + positionSizeUSD / config.perpLeverage;
        const actualSize = Math.min(positionSizeUSD, availableCash * config.perpLeverage / (config.perpLeverage + 1));

        if (actualSize < 1000) continue; // min position size

        const entryFee = actualSize * 2 * (config.tradingFeeBps / 10000); // both legs
        const cashUsed = actualSize + actualSize / config.perpLeverage + entryFee;

        portfolio.positions.push({
          coin: signal.coin,
          spotSizeUSD: actualSize,
          perpSizeUSD: actualSize,
          entrySpotPrice: snap.spotPriceUSD,
          entryTimestamp: ts,
          cumulativeFundingUSD: 0,
          cumulativeFeesUSD: entryFee,
        });
        portfolio.cashUSD -= cashUsed;
        portfolio.cumulativeFeesUSD += entryFee;
        totalEntries++;
        actionStr = `ENTER ${signal.coin} $${actualSize.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${signal.reason})`;
      }

      if (signal.action === "exit") {
        const posIdx = portfolio.positions.findIndex((p) => p.coin === signal.coin);
        if (posIdx === -1) continue;
        const pos = portfolio.positions[posIdx];

        const exitFee = pos.spotSizeUSD * 2 * (config.tradingFeeBps / 10000);
        pos.cumulativeFeesUSD += exitFee;
        portfolio.cumulativeFeesUSD += exitFee;

        // Close delta-neutral: recover spot notional + margin + net funding
        const posValue = calcPositionValue(pos, 0); // price-independent for delta-neutral
        const margin = pos.perpSizeUSD / config.perpLeverage;
        const netPnl = pos.cumulativeFundingUSD - pos.cumulativeFeesUSD;
        portfolio.cashUSD += posValue + margin;
        portfolio.cumulativePnlUSD += netPnl;

        portfolio.positions.splice(posIdx, 1);
        totalExits++;
        actionStr = `EXIT ${pos.coin} net $${netPnl.toFixed(2)} (funding $${pos.cumulativeFundingUSD.toFixed(0)} - fees $${pos.cumulativeFeesUSD.toFixed(0)}) (${signal.reason})`;
      }

      if (signal.action === "increase" || signal.action === "decrease") {
        const pos = portfolio.positions.find((p) => p.coin === signal.coin);
        if (!pos) continue;
        // Simplified: just log, don't resize for now
        actionStr = `${signal.action.toUpperCase()} ${signal.coin} (${signal.reason})`;
      }
    }

    // Recalculate total value: cash + positions (notional + margin + net funding)
    let positionsValue = 0;
    for (const pos of portfolio.positions) {
      positionsValue += calcPositionValue(pos, 0); // delta-neutral, price-independent
      positionsValue += pos.perpSizeUSD / config.perpLeverage; // margin held
    }
    portfolio.totalValueUSD = portfolio.cashUSD + positionsValue;

    dailyLog.push({
      date,
      totalValue: portfolio.totalValueUSD,
      cash: portfolio.cashUSD,
      positions: portfolio.positions.map((p) => `${p.coin}:$${p.spotSizeUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join(", ") || "none",
      funding: portfolio.cumulativeFundingUSD,
      fees: portfolio.cumulativeFeesUSD,
      action: actionStr,
    });
  }

  // Results
  const totalDays = (endTs - startTs) / daySeconds;
  const totalReturn = (portfolio.totalValueUSD - config.initialCapitalUSD) / config.initialCapitalUSD;
  const annualized = (Math.pow(1 + totalReturn, 365 / totalDays) - 1) * 100;

  // Benchmark: what if you just held BTC spot?
  const startSnaps = await dataModule.getAt(startTs) as FundingSnapshot[];
  const endSnaps = await dataModule.getAt(endTs) as FundingSnapshot[];
  const btcStart = startSnaps.find((s) => s.coin === "BTC")?.spotPriceUSD ?? 0;
  const btcEnd = endSnaps.find((s) => s.coin === "BTC")?.spotPriceUSD ?? 0;
  const ethStart = startSnaps.find((s) => s.coin === "ETH")?.spotPriceUSD ?? 0;
  const ethEnd = endSnaps.find((s) => s.coin === "ETH")?.spotPriceUSD ?? 0;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  BACKTEST: Funding Rate Basis Capture (Strategy 2a)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Capital:    $${config.initialCapitalUSD.toLocaleString()}`);
  console.log(`  Period:     ${startDate} → ${endDate} (${Math.round(totalDays)} days)`);
  console.log(`  Coins:      ${config.coins.join(", ")}`);
  console.log(`  Leverage:   ${config.perpLeverage}x perp`);
  console.log(`  Entry:      ≥8% annualized funding, 70% persistence`);
  console.log(`  Exit:       <2% annualized funding`);
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("── RESULTS ────────────────────────────────────────────────");
  console.log(`  Final value:        $${portfolio.totalValueUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  console.log(`  Total return:       ${(totalReturn * 100).toFixed(2)}%`);
  console.log(`  Annualized return:  ${annualized.toFixed(2)}%`);
  console.log(`  Cumulative funding: $${portfolio.cumulativeFundingUSD.toFixed(2)}`);
  console.log(`  Cumulative fees:    $${portfolio.cumulativeFeesUSD.toFixed(2)}`);
  console.log(`  Net funding yield:  $${(portfolio.cumulativeFundingUSD - portfolio.cumulativeFeesUSD).toFixed(2)}`);
  console.log(`  Entries / Exits:    ${totalEntries} / ${totalExits}`);
  console.log(`  Days in position:   ${daysInPosition} / ${Math.round(totalDays)} (${(daysInPosition / totalDays * 100).toFixed(0)}%)`);

  console.log("\n── CURRENT POSITIONS ──────────────────────────────────────");
  if (portfolio.positions.length === 0) {
    console.log("  No open positions");
  } else {
    for (const pos of portfolio.positions) {
      const snap = (await dataModule.getAt(endTs) as FundingSnapshot[]).find((s) => s.coin === pos.coin);
      const value = snap ? calcPositionValue(pos, snap.spotPriceUSD) : 0;
      console.log(`  ${pos.coin}: spot $${pos.spotSizeUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} | funding $${pos.cumulativeFundingUSD.toFixed(2)} | fees $${pos.cumulativeFeesUSD.toFixed(2)} | net $${(value - pos.spotSizeUSD).toFixed(2)}`);
    }
  }

  console.log("\n── BENCHMARKS ─────────────────────────────────────────────");
  if (btcStart > 0 && btcEnd > 0) {
    const btcReturn = (btcEnd - btcStart) / btcStart * 100;
    console.log(`  BTC buy-and-hold:   ${btcReturn.toFixed(2)}% ($${btcStart.toFixed(0)} → $${btcEnd.toFixed(0)})`);
  }
  if (ethStart > 0 && ethEnd > 0) {
    const ethReturn = (ethEnd - ethStart) / ethStart * 100;
    console.log(`  ETH buy-and-hold:   ${ethReturn.toFixed(2)}% ($${ethStart.toFixed(0)} → $${ethEnd.toFixed(0)})`);
  }
  console.log(`  Cash (0% return):   0.00%`);

  // Trade log
  const entries = dailyLog.filter((d) => d.action.startsWith("ENTER") || d.action.startsWith("EXIT"));
  console.log(`\n── TRADE LOG (${entries.length} events) ──────────────────────────────`);
  for (const e of entries.slice(0, 20)) {
    console.log(`  ${e.date}  $${e.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}  ${e.action}`);
  }
  if (entries.length > 20) console.log(`  ... and ${entries.length - 20} more`);

  // Monthly breakdown
  console.log("\n── MONTHLY PERFORMANCE ────────────────────────────────────");
  const monthlyMap = new Map<string, { start: number; end: number; funding: number }>();
  for (const d of dailyLog) {
    const month = d.date.slice(0, 7);
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { start: d.totalValue, end: d.totalValue, funding: 0 });
    }
    const m = monthlyMap.get(month)!;
    m.end = d.totalValue;
  }

  let prevEnd = config.initialCapitalUSD;
  for (const [month, data] of [...monthlyMap.entries()].sort()) {
    const monthReturn = (data.end - prevEnd) / prevEnd * 100;
    console.log(`  ${month}:  ${monthReturn >= 0 ? "+" : ""}${monthReturn.toFixed(2)}%  ($${data.end.toLocaleString(undefined, { maximumFractionDigits: 0 })})`);
    prevEnd = data.end;
  }

  console.log("\n═══════════════════════════════════════════════════════════");
}

main().catch(console.error);
