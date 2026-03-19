import { handleYieldOpportunities } from "./yield.js";
import { handleCarryScreener } from "./carry.js";
import { handleGasEstimate } from "./gas.js";
import { handlePredictionSignals } from "./prediction-signals.js";
import { log } from "../logging/logger.js";

export const findStrategyDescription = `Composable strategy finder — scans yield, carry trades, lending leverage, prediction markets, and gas costs to surface the best opportunities for a given asset and risk profile.
The intelligence layer that connects all Syenite data sources. Tell it what you have, and it tells you what to do.
Returns ranked strategies with expected return, risk level, execution steps, and which Syenite tools to call next.`;

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

interface Strategy {
  rank: number;
  name: string;
  category: "yield" | "carry" | "leverage" | "prediction" | "arbitrage";
  expectedAPY: number;
  risk: "low" | "medium" | "high";
  summary: string;
  details: Record<string, unknown>;
  executionSteps: string[];
  tools: string[];
}

export async function handleFindStrategy(params: {
  asset: string;
  amount?: number;
  riskTolerance?: string;
  chain?: string;
  includePrediction?: boolean;
}): Promise<Record<string, unknown>> {
  const asset = params.asset.toUpperCase();
  const amount = params.amount ?? 10000;
  const maxRisk = params.riskTolerance ?? "high";
  const chain = params.chain ?? "all";
  const includePrediction = params.includePrediction ?? true;

  const isStable = ["USDC", "USDT", "DAI", "GHO", "USDE"].includes(asset);
  const isETH = ["ETH", "WETH", "STETH", "WSTETH", "RETH", "CBETH", "WEETH"].includes(asset);
  const isBTC = ["BTC", "WBTC", "TBTC", "CBBTC"].includes(asset);

  // Fan out data fetches in parallel
  const [yieldResult, carryResult, gasResult, predictionResult] = await Promise.allSettled([
    handleYieldOpportunities({
      asset: isStable ? "stables" : isETH ? "ETH" : asset,
      riskTolerance: maxRisk,
    }),
    handleCarryScreener({
      collateral: isETH ? "ETH" : isBTC ? "BTC" : "all",
      borrowAsset: isStable ? asset : "USDC",
      chain,
      positionSizeUSD: amount,
    }),
    handleGasEstimate({
      operations: ["swap", "lending_supply", "lending_borrow"],
    }),
    includePrediction
      ? handlePredictionSignals({ minStrength: 10, limit: 5 })
      : Promise.resolve(null),
  ]);

  const strategies: Strategy[] = [];

  // ── Yield strategies ──────────────────────────────────────────────
  if (yieldResult.status === "fulfilled") {
    const yields = yieldResult.value;
    const opps = yields.opportunities as Array<Record<string, unknown>>;

    for (const opp of opps.slice(0, 5)) {
      const apy = opp.apy as number;
      const risk = opp.risk as "low" | "medium" | "high";
      const protocol = opp.protocol as string;
      const product = opp.product as string;
      const category = opp.category as string;
      const annualReturn = round(amount * (apy / 100));

      strategies.push({
        rank: 0,
        name: `${protocol} ${product}`,
        category: "yield",
        expectedAPY: apy,
        risk,
        summary: `Deposit ${asset} into ${protocol} ${product} for ${round(apy)}% APY (~$${annualReturn.toLocaleString()}/yr on $${amount.toLocaleString()}).`,
        details: {
          protocol,
          product,
          apy: round(apy),
          category,
          tvlUSD: opp.tvlUSD,
          lockup: opp.lockup,
          annualReturnUSD: annualReturn,
        },
        executionSteps: category === "liquid-staking"
          ? [
              `Swap ${asset} for ${product} via swap.quote`,
              "Hold staked derivative to earn staking yield",
            ]
          : [
              `Supply ${asset} to ${protocol} ${product}`,
              `Use lending.rates.query to monitor rates`,
            ],
        tools: ["swap.quote", "yield.assess", "lending.rates.query"],
      });
    }
  }

  // ── Carry strategies ──────────────────────────────────────────────
  if (carryResult.status === "fulfilled") {
    const carry = carryResult.value;
    const carryStrategies = carry.strategies as Array<Record<string, unknown>>;

    for (const cs of carryStrategies.filter((s) => (s.netCarry as number) > 0).slice(0, 3)) {
      const netCarry = cs.netCarry as number;
      const leveragedCarry = cs.leveragedCarry as number;
      const protocol = cs.protocol as string;
      const market = cs.market as string;
      const collateral = cs.collateral as string;
      const borrowAsset = cs.borrowAsset as string;
      const maxLTV = cs.maxLTV as number;
      const annualReturn = round(amount * (netCarry / 100));
      const leveragedReturn = round(amount * (leveragedCarry / 100));

      strategies.push({
        rank: 0,
        name: `${protocol} carry: ${collateral}/${borrowAsset}`,
        category: "carry",
        expectedAPY: netCarry,
        risk: netCarry > 2 ? "medium" : "low",
        summary: `Deposit ${collateral} on ${protocol}, earn ${round(cs.supplyAPY as number)}% supply APY while borrowing ${borrowAsset} at ${round(cs.borrowAPY as number)}%. Net carry ${round(netCarry)}% (~$${annualReturn.toLocaleString()}/yr). Leveraged: ${round(leveragedCarry)}% (~$${leveragedReturn.toLocaleString()}/yr).`,
        details: {
          protocol,
          chain: cs.chain,
          market,
          collateral,
          borrowAsset,
          supplyAPY: cs.supplyAPY,
          borrowAPY: cs.borrowAPY,
          netCarry: round(netCarry),
          leveragedCarry: round(leveragedCarry),
          maxLTV: round(maxLTV),
          annualReturnUSD: annualReturn,
          leveragedReturnUSD: leveragedReturn,
          availableLiquidityUSD: cs.availableLiquidityUSD,
        },
        executionSteps: [
          `Supply ${collateral} to ${protocol} (${market})`,
          `Borrow ${borrowAsset} against collateral at safe LTV`,
          `Monitor health factor via lending.position.monitor`,
          `Set alerts via alerts.watch for liquidation protection`,
        ],
        tools: ["lending.rates.query", "lending.risk.assess", "lending.position.monitor", "alerts.watch"],
      });
    }
  }

  // ── Leverage strategies (for non-stables) ─────────────────────────
  if (!isStable && carryResult.status === "fulfilled") {
    const carry = carryResult.value;
    const carryStrategies = carry.strategies as Array<Record<string, unknown>>;
    const best = carryStrategies[0];

    if (best) {
      const maxLTV = best.maxLTV as number;
      const borrowAPY = best.borrowAPY as number;
      const protocol = best.protocol as string;
      const safeLTV = round(maxLTV * 0.5);
      const leverage = round(1 / (1 - safeLTV / 100));

      strategies.push({
        rank: 0,
        name: `${protocol} leveraged ${asset}`,
        category: "leverage",
        expectedAPY: round(-borrowAPY),
        risk: "high",
        summary: `Leverage ${asset} exposure: deposit, borrow stables at ${round(borrowAPY)}%, buy more ${asset}. ${round(leverage)}x exposure at ${safeLTV}% LTV. Profitable if ${asset} appreciates > ${round(borrowAPY)}% annually.`,
        details: {
          protocol,
          targetLTV: safeLTV,
          leverage: round(leverage),
          borrowCost: round(borrowAPY),
          breakeven: `${asset} must appreciate >${round(borrowAPY)}% to profit`,
          liquidationRisk: `Liquidation at ${round(maxLTV)}% LTV — set alerts.watch`,
        },
        executionSteps: [
          `Supply ${asset} to ${protocol}`,
          `Borrow stables at ${safeLTV}% LTV`,
          `Swap borrowed stables back to ${asset} via swap.quote`,
          `Supply additional ${asset} for loop (repeat for more leverage)`,
          `Monitor health via lending.position.monitor + alerts.watch`,
        ],
        tools: ["lending.risk.assess", "swap.quote", "lending.position.monitor", "alerts.watch"],
      });
    }
  }

  // ── Cross-chain rate arbitrage ────────────────────────────────────
  if (carryResult.status === "fulfilled") {
    const carryStrategies = (carryResult.value.strategies as Array<Record<string, unknown>>)
      .filter((s) => (s.supplyAPY as number) > 0);

    const byCollateral = new Map<string, Array<Record<string, unknown>>>();
    for (const s of carryStrategies) {
      const key = s.collateral as string;
      if (!byCollateral.has(key)) byCollateral.set(key, []);
      byCollateral.get(key)!.push(s);
    }

    for (const [collateral, markets] of byCollateral) {
      if (markets.length < 2) continue;
      const sorted = [...markets].sort((a, b) => (b.supplyAPY as number) - (a.supplyAPY as number));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      const spread = (best.supplyAPY as number) - (worst.supplyAPY as number);

      if (spread > 0.5) {
        strategies.push({
          rank: 0,
          name: `${collateral} supply rate arb: ${best.protocol}/${best.chain} vs ${worst.protocol}/${worst.chain}`,
          category: "arbitrage",
          expectedAPY: round(spread),
          risk: "low",
          summary: `${collateral} supply rate spread: ${round(best.supplyAPY as number)}% on ${best.protocol} (${best.chain}) vs ${round(worst.supplyAPY as number)}% on ${worst.protocol} (${worst.chain}). Move ${collateral} to capture ${round(spread)}% additional yield.`,
          details: {
            collateral,
            bestVenue: { protocol: best.protocol, chain: best.chain, supplyAPY: round(best.supplyAPY as number) },
            worstVenue: { protocol: worst.protocol, chain: worst.chain, supplyAPY: round(worst.supplyAPY as number) },
            spreadAPY: round(spread),
            annualGainUSD: round(amount * (spread / 100)),
          },
          executionSteps: [
            `Withdraw ${collateral} from ${worst.protocol} (${worst.chain}) if currently deposited`,
            `Bridge to ${best.chain} via swap.quote if needed`,
            `Supply to ${best.protocol} on ${best.chain}`,
            `Monitor rate convergence — rates are variable`,
          ],
          tools: ["swap.quote", "lending.rates.query", "gas.estimate"],
        });
      }
    }
  }

  // ── Prediction market signals ─────────────────────────────────────
  if (predictionResult.status === "fulfilled" && predictionResult.value) {
    const pred = predictionResult.value;
    const signals = pred.signals as Array<Record<string, unknown>>;

    for (const sig of signals.slice(0, 3)) {
      const type = sig.type as string;
      const strength = sig.strength as number;

      if (type === "wide_spread" || type === "mispriced") {
        strategies.push({
          rank: 0,
          name: `Prediction: ${sig.market}`,
          category: "prediction",
          expectedAPY: round(strength),
          risk: "high",
          summary: sig.action as string,
          details: {
            signalType: type,
            strength,
            market: sig.market,
            question: sig.question,
            ...Object.fromEntries(
              Object.entries(sig).filter(([k]) => !["type", "strength", "market", "question", "action"].includes(k))
            ),
          },
          executionSteps: type === "wide_spread"
            ? [
                "Use prediction.book to check current order book depth",
                "Place limit orders on both sides of the spread",
                "Monitor fill rate and adjust prices",
              ]
            : [
                "Verify probability mismatch with prediction.book",
                "Buy underpriced outcome tokens",
                "Sell or hold to resolution",
              ],
          tools: ["prediction.book", "prediction.trending"],
        });
      }
    }
  }

  // ── Rank strategies ───────────────────────────────────────────────
  const riskFilter = { low: 1, medium: 2, high: 3 }[maxRisk] ?? 3;
  const riskMap: Record<string, number> = { low: 1, medium: 2, high: 3 };

  const filtered = strategies.filter((s) => riskMap[s.risk] <= riskFilter);

  // Score: APY weighted by inverse risk
  filtered.sort((a, b) => {
    const aScore = a.expectedAPY * (4 - riskMap[a.risk]);
    const bScore = b.expectedAPY * (4 - riskMap[b.risk]);
    return bScore - aScore;
  });

  for (let i = 0; i < filtered.length; i++) {
    filtered[i].rank = i + 1;
  }

  // Gas context
  let gasContext: Record<string, unknown> | undefined;
  if (gasResult.status === "fulfilled") {
    const cheapest = gasResult.value.cheapestChain as Record<string, { chain: string; costUSD: string }>;
    gasContext = {
      cheapestSwapChain: cheapest.swap?.chain,
      swapGasCost: cheapest.swap?.costUSD,
      cheapestLendingChain: cheapest.lending_supply?.chain,
      lendingGasCost: cheapest.lending_supply?.costUSD,
    };
  }

  const categoryCounts: Record<string, number> = {};
  for (const s of filtered) {
    categoryCounts[s.category] = (categoryCounts[s.category] ?? 0) + 1;
  }

  return {
    query: { asset, amount, riskTolerance: maxRisk, chain, includePrediction },
    summary: {
      strategiesFound: filtered.length,
      bestStrategy: filtered[0]
        ? { name: filtered[0].name, expectedAPY: filtered[0].expectedAPY, risk: filtered[0].risk, category: filtered[0].category }
        : null,
      categoryCounts,
      gasContext,
    },
    strategies: filtered.map((s) => ({
      rank: s.rank,
      name: s.name,
      category: s.category,
      expectedAPY: s.expectedAPY,
      risk: s.risk,
      summary: s.summary,
      details: s.details,
      executionSteps: s.executionSteps,
      tools: s.tools,
    })),
    timestamp: new Date().toISOString(),
    note: "Strategies are ranked by risk-adjusted return. APYs are current and variable. Carry and leverage strategies require active monitoring. Use the listed tools to execute each step. — syenite.ai",
  };
}
