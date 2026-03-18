import { getLendingSupplyYields } from "../data/yield-lending.js";
import { getMakerDSRYield } from "../data/yield-savings.js";
import { getStakingYields } from "../data/yield-staking.js";
import { getVaultYields } from "../data/yield-vaults.js";
import { getStructuredYields } from "../data/yield-structured.js";
import type { YieldOpportunity, YieldCategory } from "../data/types.js";

export const yieldToolName = "yield.opportunities";

export const yieldToolDescription = `Find the best DeFi yield opportunities for any asset across blue-chip protocols on Ethereum.
Aggregates yields from lending supply (Aave, Morpho, Spark), liquid staking (Lido, Rocket Pool, Coinbase), savings rates (Maker DSR/sDAI), vaults (MetaMorpho, Yearn), and basis capture (Ethena sUSDe).
Returns opportunities ranked by APY with risk level, TVL, lockup period, and protocol details. Filter by asset, category, or risk tolerance.`;

export const yieldToolSchema = {
  asset: {
    type: "string" as const,
    description:
      'Asset to find yield for: "ETH", "USDC", "DAI", "WETH", "USDe", or "all" (default). Returns all yield sources for that asset.',
  },
  category: {
    type: "string" as const,
    description:
      'Filter by yield category: "lending-supply", "liquid-staking", "vault", "savings-rate", "basis-capture", or "all" (default).',
  },
  riskTolerance: {
    type: "string" as const,
    description:
      'Maximum risk level: "low" (safest only), "medium" (includes moderate risk), "high" (everything). Default "high" (show all).',
  },
};

const RISK_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3 };

export async function handleYieldOpportunities(params: {
  asset?: string;
  category?: string;
  riskTolerance?: string;
}): Promise<string> {
  const asset = params.asset ?? "all";
  const category = params.category ?? "all";
  const maxRisk = RISK_ORDER[params.riskTolerance ?? "high"] ?? 3;

  const [lending, savings, staking, vaults, structured] = await Promise.allSettled([
    getLendingSupplyYields(asset),
    getMakerDSRYield(),
    getStakingYields(),
    getVaultYields(),
    getStructuredYields(),
  ]);

  let allYields: YieldOpportunity[] = [
    ...(lending.status === "fulfilled" ? lending.value : []),
    ...(savings.status === "fulfilled" ? savings.value : []),
    ...(staking.status === "fulfilled" ? staking.value : []),
    ...(vaults.status === "fulfilled" ? vaults.value : []),
    ...(structured.status === "fulfilled" ? structured.value : []),
  ];

  if (asset && asset !== "all") {
    const filter = asset.toLowerCase();
    allYields = allYields.filter((y) => {
      const yAsset = y.asset.toLowerCase();
      if (yAsset === filter) return true;
      if (filter === "eth" && ["eth", "weth"].includes(yAsset)) return true;
      if (filter === "stables" && ["usdc", "usdt", "dai", "gho", "usde"].includes(yAsset)) return true;
      return false;
    });
  }

  if (category && category !== "all") {
    allYields = allYields.filter((y) => y.category === category);
  }

  allYields = allYields.filter((y) => RISK_ORDER[y.risk] <= maxRisk);

  allYields.sort((a, b) => b.apy - a.apy);

  if (allYields.length === 0) {
    return JSON.stringify({
      status: "no_opportunities",
      message: `No yield opportunities found for asset=${asset}, category=${category}, riskTolerance=${params.riskTolerance ?? "high"}`,
    });
  }

  const byRisk = {
    low: allYields.filter((y) => y.risk === "low"),
    medium: allYields.filter((y) => y.risk === "medium"),
    high: allYields.filter((y) => y.risk === "high"),
  };

  const bestOverall = allYields[0];
  const bestLowRisk = byRisk.low[0] ?? null;

  return JSON.stringify({
    query: { asset, category, riskTolerance: params.riskTolerance ?? "high" },
    summary: {
      totalOpportunities: allYields.length,
      bestAPY: { protocol: bestOverall.protocol, product: bestOverall.product, apy: round(bestOverall.apy), risk: bestOverall.risk },
      ...(bestLowRisk && bestLowRisk !== bestOverall && {
        bestLowRiskAPY: { protocol: bestLowRisk.protocol, product: bestLowRisk.product, apy: round(bestLowRisk.apy) },
      }),
      categoryCounts: {
        "lending-supply": allYields.filter((y) => y.category === "lending-supply").length,
        "liquid-staking": allYields.filter((y) => y.category === "liquid-staking").length,
        vault: allYields.filter((y) => y.category === "vault").length,
        "savings-rate": allYields.filter((y) => y.category === "savings-rate").length,
        "basis-capture": allYields.filter((y) => y.category === "basis-capture").length,
      },
    },
    opportunities: allYields.map((y) => ({
      protocol: y.protocol,
      product: y.product,
      asset: y.asset,
      apy: round(y.apy),
      apyType: y.apyType,
      tvlUSD: round(y.tvlUSD),
      category: y.category,
      risk: y.risk,
      riskNotes: y.riskNotes,
      lockup: y.lockup,
    })),
    timestamp: new Date().toISOString(),
    note: "All yields sourced from on-chain data. Yields marked 'estimated' will improve to trailing-7d accuracy as historical data accumulates (typically 24-48h after deployment). Variable rates change with market conditions. Higher APY generally correlates with higher risk.",
  });
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
