import { getAaveRates, getSparkRates } from "../data/aave.js";
import { getMorphoRates } from "../data/morpho.js";
import { getTokenPrice } from "../data/prices.js";
import type { ProtocolRate, RiskAssessment } from "../data/types.js";
import { SyeniteError } from "../errors.js";

export const riskToolName = "lending.risk.assess";

export const riskToolDescription = `Evaluates the risk of a proposed lending position before it is opened — fetching live rates, current asset price, and available liquidity from Aave v3, Morpho Blue, and Spark to compute position-specific risk metrics.
Call this before \`lending.supply\` and \`lending.borrow\` whenever an agent is about to open or resize a collateralized borrow; it surfaces the protocol with the lowest borrow APY that accepts the target LTV.
Provide \`collateral\` asset symbol (e.g. "wBTC", "wstETH"), \`collateralAmount\` (token units), \`targetLTV\` (percentage, e.g. 60), and optionally \`borrowAsset\` (default "USDC") and \`protocol\` preference ("aave-v3", "spark", "morpho-blue", or "best").
Returns a risk score (1–10), liquidation price and distance, liquidation penalty in USD, position sizing warnings if the borrow is large relative to pool liquidity, collateral-specific depeg notes, protocol oracle and governance notes, estimated annual borrow cost, and an actionable plain-language summary; does not execute any transaction.`;

const PROTOCOL_RISK: Record<string, { oracleType: string; liquidationMechanism: string; governance: string; notes: string }> = {
  "aave-v3": {
    oracleType: "Chainlink price feeds with fallback",
    liquidationMechanism: "Partial liquidation — up to 50% of debt repaid per liquidation call. Penalty applied to collateral seized. Third-party liquidators compete on-chain.",
    governance: "Aave DAO with 24hr+ timelock on parameter changes. Emergency admin can pause markets.",
    notes: "Battle-tested since 2020. $10B+ TVL. Largest DeFi lending protocol.",
  },
  "morpho-blue": {
    oracleType: "Market-specific oracles (Chainlink, Morpho oracles, or custom). Set at market creation and immutable.",
    liquidationMechanism: "Full liquidation — entire position can be liquidated in one call once LTV exceeds LLTV. Penalty is lower than Aave but exposure is binary.",
    governance: "Immutable core contracts — no admin keys, no upgrades. Market parameters fixed at creation. Risk is per-market, not protocol-wide.",
    notes: "Newer protocol (2024). Simpler design with isolated markets. No cross-collateral risk.",
  },
  spark: {
    oracleType: "Chainlink price feeds (same model as Aave v3)",
    liquidationMechanism: "Identical to Aave v3 — partial liquidation with bonus to liquidators.",
    governance: "Spark DAO (MakerDAO ecosystem). Separate governance from Aave with similar timelock mechanisms.",
    notes: "Aave v3 fork operated by Maker/Sky ecosystem. Focused on DAI/sDAI markets. Lower TVL than Aave but institutional backing.",
  },
};

const COLLATERAL_RISK: Record<string, { level: string; notes: string }> = {
  wBTC: {
    level: "low",
    notes: "Most liquid BTC wrapper. Centralized custody via BitGo (BiT Global). Low depeg risk but single custodian dependency.",
  },
  tBTC: {
    level: "medium",
    notes: "Decentralized minting via threshold signatures. Lower liquidity than wBTC. Slight depeg risk in thin markets.",
  },
  cbBTC: {
    level: "low-medium",
    notes: "Coinbase-issued. Strong institutional backing but single-entity risk. Relatively new.",
  },
  WETH: {
    level: "low",
    notes: "Wrapped native ETH. No depeg risk — 1:1 redeemable. Deepest liquidity in DeFi.",
  },
  wstETH: {
    level: "low",
    notes: "Lido wrapped staked ETH. Largest LST by TVL. Slight depeg possible in extreme conditions but strong secondary market liquidity.",
  },
  rETH: {
    level: "low",
    notes: "Rocket Pool staked ETH. Decentralized staking. Slight premium/discount possible vs ETH spot.",
  },
  cbETH: {
    level: "low-medium",
    notes: "Coinbase staked ETH. Centralized staking operator. Strong institutional backing.",
  },
  weETH: {
    level: "medium",
    notes: "EtherFi wrapped eETH. Restaking token — additional smart contract risk from EigenLayer. Growing liquidity.",
  },
};

export async function handleRiskAssess(params: {
  collateral: string;
  collateralAmount: number;
  borrowAsset?: string;
  targetLTV: number;
  protocol?: string;
}): Promise<Record<string, unknown>> {
  const { collateral, collateralAmount, targetLTV } = params;
  const borrowAsset = params.borrowAsset ?? "USDC";
  const protocolPref = params.protocol ?? "best";

  if (targetLTV <= 0 || targetLTV >= 100) {
    throw SyeniteError.invalidInput("targetLTV must be between 0 and 100 (exclusive).");
  }

  if (collateralAmount <= 0) {
    throw SyeniteError.invalidInput("collateralAmount must be positive.");
  }

  let assetPrice: number;
  try {
    assetPrice = await getTokenPrice(collateral);
  } catch (e) {
    if (e instanceof SyeniteError) throw e;
    throw SyeniteError.upstream(`Failed to fetch price for ${collateral}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const collateralUSD = collateralAmount * assetPrice;
  const borrowAmount = collateralUSD * (targetLTV / 100);

  const [aaveRates, morphoRates, sparkRates] = await Promise.allSettled([
    getAaveRates(collateral, borrowAsset),
    getMorphoRates(collateral, borrowAsset),
    getSparkRates(collateral, borrowAsset),
  ]);

  const allRates = [
    ...(aaveRates.status === "fulfilled" ? aaveRates.value : []),
    ...(morphoRates.status === "fulfilled" ? morphoRates.value : []),
    ...(sparkRates.status === "fulfilled" ? sparkRates.value : []),
  ];

  if (allRates.length === 0) {
    throw SyeniteError.notFound(`No lending markets found for ${collateral}/${borrowAsset}.`);
  }

  let candidates: ProtocolRate[];
  if (protocolPref === "best") {
    candidates = allRates;
  } else {
    const proto = protocolPref.includes("aave") ? "aave-v3" : protocolPref.includes("spark") ? "spark" : "morpho-blue";
    candidates = allRates.filter((r) => r.protocol === proto);
    if (candidates.length === 0) candidates = allRates;
  }

  const viable = candidates.filter((r) => targetLTV < r.maxLTV);
  if (viable.length === 0) {
    throw SyeniteError.invalidInput(
      `Target LTV of ${targetLTV}% exceeds maximum allowed LTV on all available markets. Maximum LTVs: ${candidates.map((r) => `${r.market}: ${r.maxLTV}%`).join(", ")}. Reduce target LTV below ${Math.min(...candidates.map((r) => r.maxLTV))}%.`
    );
  }

  const best = viable.reduce((a, b) => (a.borrowAPY < b.borrowAPY ? a : b));

  const liquidationPrice =
    collateralAmount > 0
      ? borrowAmount / (collateralAmount * (best.liquidationThreshold / 100))
      : 0;
  const distanceToLiq =
    assetPrice > 0 ? ((assetPrice - liquidationPrice) / assetPrice) * 100 : 0;

  const poolLiquidityRatio =
    best.availableLiquidityUSD > 0
      ? borrowAmount / best.availableLiquidityUSD
      : Infinity;
  const borrowAsPoolPercent = poolLiquidityRatio * 100;

  let positionSizingWarning: string | null = null;
  if (borrowAsPoolPercent > 50) {
    positionSizingWarning = `Your borrow (${round(borrowAmount)} ${borrowAsset}) is ${round(borrowAsPoolPercent)}% of the pool's available liquidity. This will significantly move the borrow rate higher and may be difficult to exit in stressed conditions.`;
  } else if (borrowAsPoolPercent > 25) {
    positionSizingWarning = `Your borrow is ${round(borrowAsPoolPercent)}% of available pool liquidity. Large enough to noticeably impact the borrow rate.`;
  } else if (borrowAsPoolPercent > 10) {
    positionSizingWarning = `Your borrow is ${round(borrowAsPoolPercent)}% of available pool liquidity — within normal range but worth monitoring.`;
  }

  let riskScore = 1;

  const ltvRatio = targetLTV / best.liquidationThreshold;
  if (ltvRatio > 0.9) riskScore += 4;
  else if (ltvRatio > 0.8) riskScore += 3;
  else if (ltvRatio > 0.7) riskScore += 2;
  else if (ltvRatio > 0.5) riskScore += 1;

  if (poolLiquidityRatio > 0.5) riskScore += 3;
  else if (poolLiquidityRatio > 0.25) riskScore += 2;
  else if (poolLiquidityRatio > 0.1) riskScore += 1;

  const collateralRisk = COLLATERAL_RISK[collateral] ?? {
    level: "unknown",
    notes: "Unknown collateral asset — exercise caution.",
  };
  if (collateralRisk.level === "medium") riskScore += 1;
  if (collateralRisk.level === "high" || collateralRisk.level === "unknown") riskScore += 2;

  riskScore = Math.min(riskScore, 10);

  const annualCost = borrowAmount * (best.borrowAPY / 100);
  const autoUnwindRecommended = ltvRatio > 0.6 || riskScore > 5;
  const recommendedLTV = Math.min(targetLTV, best.liquidationThreshold * 0.65);

  const protocolKey = best.protocol as string;
  const protocolRisk = PROTOCOL_RISK[protocolKey] ?? {
    oracleType: "Unknown",
    liquidationMechanism: "Unknown",
    governance: "Unknown",
    notes: "No protocol risk data available.",
  };

  const liqPenaltyUSD = round((collateralUSD * targetLTV / 100) * (best.liquidationPenalty / 100));

  let summary: string;
  if (riskScore <= 3) {
    summary = `Low risk. ${collateral} at ${targetLTV}% LTV on ${best.market}. ${round(distanceToLiq)}% price drop to liquidation. If liquidated, ~$${liqPenaltyUSD} penalty (${round(best.liquidationPenalty)}%).`;
  } else if (riskScore <= 6) {
    summary = `Moderate risk. ${collateral} at ${targetLTV}% LTV on ${best.market}. Consider reducing to ${round(recommendedLTV)}% LTV. Liquidation penalty: ${round(best.liquidationPenalty)}% ($${liqPenaltyUSD}).`;
  } else {
    summary = `High risk. ${collateral} at ${targetLTV}% LTV on ${best.market} — only ${round(distanceToLiq)}% from liquidation. Penalty on liquidation: ${round(best.liquidationPenalty)}% ($${liqPenaltyUSD}). Strongly recommend reducing LTV.`;
  }

  const assessment: RiskAssessment = {
    riskScore,
    recommendedProtocol: best.market,
    recommendedLTV: round(recommendedLTV),
    liquidationPrice: round(liquidationPrice),
    liquidationPenalty: round(best.liquidationPenalty),
    distanceToLiquidation: round(distanceToLiq),
    positionSizing: {
      poolLiquidityRatio: round(poolLiquidityRatio, 4),
      borrowAsPoolPercent: round(borrowAsPoolPercent),
      warning: positionSizingWarning,
    },
    collateralRisk,
    protocolRisk,
    estimatedAnnualCost: round(annualCost),
    autoUnwindRecommended,
    summary,
  };

  return {
    query: {
      collateral,
      collateralAmount,
      collateralValueUSD: round(collateralUSD),
      borrowAsset,
      borrowAmount: round(borrowAmount),
      targetLTV,
      assetPrice: round(assetPrice),
    },
    assessment,
    alternativeMarkets: viable
      .filter((r) => r.market !== best.market)
      .map((r) => ({
        market: r.market,
        borrowAPY: round(r.borrowAPY),
        liquidationPenalty: round(r.liquidationPenalty),
        availableLiquidityUSD: round(r.availableLiquidityUSD),
      })),
    timestamp: new Date().toISOString(),
  };
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
