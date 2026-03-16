import { getAaveRates } from "../data/aave.js";
import { getMorphoRates } from "../data/morpho.js";
import { getBtcPrice } from "../data/prices.js";
import type { ProtocolRate, RiskAssessment } from "../data/types.js";

export const riskToolName = "lending.risk.assess";

export const riskToolDescription = `Assess the risk of a proposed BTC lending position before opening it.
Returns a risk score (1-10), recommended protocol, recommended LTV, liquidation price, pool liquidity adequacy, wrapper-specific risk notes, estimated annual cost, and whether auto-unwind protection is recommended.
Use this before lending.position.open to evaluate whether a position is safe and which protocol offers the best risk-adjusted terms.`;

export const riskToolSchema = {
  collateral: {
    type: "string" as const,
    description: 'BTC wrapper: "wBTC", "tBTC", or "cbBTC".',
  },
  collateralAmount: {
    type: "number" as const,
    description: "Amount of BTC collateral (in BTC, not satoshis).",
  },
  borrowAsset: {
    type: "string" as const,
    description: 'Stablecoin to borrow. Default "USDC".',
  },
  targetLTV: {
    type: "number" as const,
    description: "Desired loan-to-value ratio (0-100). Higher = more leverage, more risk.",
  },
  protocol: {
    type: "string" as const,
    description:
      'Specific protocol to assess: "aave-v3", "morpho", or "best" for recommendation (default).',
  },
};

const WRAPPER_RISK: Record<string, { level: string; notes: string }> = {
  wBTC: {
    level: "low",
    notes:
      "wBTC is the most liquid BTC wrapper with deepest DeFi integration. Centralized custody via BitGo (BiT Global). Low depeg risk but single custodian dependency.",
  },
  tBTC: {
    level: "medium",
    notes:
      "tBTC uses decentralized minting via threshold signatures. Lower liquidity than wBTC. Institutional version uses segregated qualified custody (Anchorage). Slight depeg risk in thin markets.",
  },
  cbBTC: {
    level: "low-medium",
    notes:
      "cbBTC is Coinbase-issued. Strong institutional backing but Coinbase single-entity risk. Relatively new — liquidity still building in some DeFi markets.",
  },
};

export async function handleRiskAssess(params: {
  collateral: string;
  collateralAmount: number;
  borrowAsset?: string;
  targetLTV: number;
  protocol?: string;
}): Promise<string> {
  const { collateral, collateralAmount, targetLTV } = params;
  const borrowAsset = params.borrowAsset ?? "USDC";
  const protocolPref = params.protocol ?? "best";

  if (targetLTV <= 0 || targetLTV >= 100) {
    return JSON.stringify({
      error: "invalid_ltv",
      message: "targetLTV must be between 0 and 100 (exclusive).",
    });
  }

  if (collateralAmount <= 0) {
    return JSON.stringify({
      error: "invalid_amount",
      message: "collateralAmount must be positive.",
    });
  }

  const btcPrice = await getBtcPrice();
  const collateralUSD = collateralAmount * btcPrice;
  const borrowAmount = collateralUSD * (targetLTV / 100);

  const [aaveRates, morphoRates] = await Promise.all([
    getAaveRates(collateral, borrowAsset),
    getMorphoRates(collateral, borrowAsset),
  ]);

  const allRates = [...aaveRates, ...morphoRates];

  if (allRates.length === 0) {
    return JSON.stringify({
      error: "no_markets",
      message: `No lending markets found for ${collateral}/${borrowAsset}.`,
    });
  }

  let candidates: ProtocolRate[];
  if (protocolPref === "best") {
    candidates = allRates;
  } else {
    const proto = protocolPref.includes("aave") ? "aave-v3" : "morpho-blue";
    candidates = allRates.filter((r) => r.protocol === proto);
    if (candidates.length === 0) candidates = allRates;
  }

  const viable = candidates.filter((r) => targetLTV < r.maxLTV);
  if (viable.length === 0) {
    return JSON.stringify({
      error: "ltv_exceeds_max",
      message: `Target LTV of ${targetLTV}% exceeds maximum allowed LTV on all available markets. Maximum LTVs: ${candidates.map((r) => `${r.market}: ${r.maxLTV}%`).join(", ")}`,
      recommendation: `Reduce target LTV below ${Math.min(...candidates.map((r) => r.maxLTV))}%`,
    });
  }

  const best = viable.reduce((a, b) => (a.borrowAPY < b.borrowAPY ? a : b));

  const liquidationPrice =
    collateralAmount > 0
      ? borrowAmount / (collateralAmount * (best.liquidationThreshold / 100))
      : 0;
  const distanceToLiq =
    btcPrice > 0 ? ((btcPrice - liquidationPrice) / btcPrice) * 100 : 0;

  const poolLiquidityRatio =
    best.availableLiquidityUSD > 0
      ? borrowAmount / best.availableLiquidityUSD
      : Infinity;

  // ── Risk scoring (1 = lowest risk, 10 = highest) ─────────────
  let riskScore = 1;

  // LTV contribution (0-4 points)
  const ltvRatio = targetLTV / best.liquidationThreshold;
  if (ltvRatio > 0.9) riskScore += 4;
  else if (ltvRatio > 0.8) riskScore += 3;
  else if (ltvRatio > 0.7) riskScore += 2;
  else if (ltvRatio > 0.5) riskScore += 1;

  // Liquidity contribution (0-3 points)
  if (poolLiquidityRatio > 0.5) riskScore += 3;
  else if (poolLiquidityRatio > 0.25) riskScore += 2;
  else if (poolLiquidityRatio > 0.1) riskScore += 1;

  // Wrapper risk (0-2 points)
  const wrapper = WRAPPER_RISK[collateral] ?? {
    level: "unknown",
    notes: "Unknown wrapper — exercise caution.",
  };
  if (wrapper.level === "medium") riskScore += 1;
  if (wrapper.level === "high" || wrapper.level === "unknown") riskScore += 2;

  riskScore = Math.min(riskScore, 10);

  const annualCost = borrowAmount * (best.borrowAPY / 100);
  const autoUnwindRecommended = ltvRatio > 0.6 || riskScore > 5;

  const recommendedLTV = Math.min(targetLTV, best.liquidationThreshold * 0.65);

  let summary: string;
  if (riskScore <= 3) {
    summary = `Low risk. ${collateral} position at ${targetLTV}% LTV on ${best.market} is well within safety margins. Distance to liquidation: ${round(distanceToLiq)}%.`;
  } else if (riskScore <= 6) {
    summary = `Moderate risk. ${collateral} position at ${targetLTV}% LTV on ${best.market}. Consider reducing LTV to ${round(recommendedLTV)}% or enabling auto-unwind protection.`;
  } else {
    summary = `High risk. ${collateral} position at ${targetLTV}% LTV on ${best.market} is close to liquidation threshold. Strongly recommend reducing LTV or enabling auto-unwind. A ${round(distanceToLiq)}% price drop triggers liquidation.`;
  }

  const assessment: RiskAssessment = {
    riskScore,
    recommendedProtocol: best.market,
    recommendedLTV: round(recommendedLTV),
    liquidationPrice: round(liquidationPrice),
    distanceToLiquidation: round(distanceToLiq),
    poolLiquidityRatio: round(poolLiquidityRatio, 4),
    wrapperRisk: wrapper,
    estimatedAnnualCost: round(annualCost),
    autoUnwindRecommended,
    summary,
  };

  return JSON.stringify({
    query: {
      collateral,
      collateralAmount,
      collateralValueUSD: round(collateralUSD),
      borrowAsset,
      borrowAmount: round(borrowAmount),
      targetLTV,
      btcPrice: round(btcPrice),
    },
    assessment,
    alternativeMarkets: viable
      .filter((r) => r.market !== best.market)
      .map((r) => ({
        market: r.market,
        borrowAPY: round(r.borrowAPY),
        availableLiquidityUSD: round(r.availableLiquidityUSD),
      })),
    timestamp: new Date().toISOString(),
  });
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
