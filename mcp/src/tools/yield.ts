import { getLendingSupplyYields } from "../data/yield-lending.js";
import { getMakerDSRYield } from "../data/yield-savings.js";
import { getStakingYields } from "../data/yield-staking.js";
import { getVaultYields } from "../data/yield-vaults.js";
import { getStructuredYields } from "../data/yield-structured.js";
import { getMetaMorphoYields } from "../data/yield-metamorpho.js";
import { getPendleYields } from "../data/yield-pendle.js";
import type { YieldOpportunity } from "../data/types.js";

export const yieldToolName = "yield.opportunities";

export const yieldToolDescription = `Find the best DeFi yield opportunities for any asset across blue-chip protocols.
Aggregates yields from lending supply (Aave, Morpho Blue on Ethereum/Base/Arbitrum/Optimism, Spark), liquid staking (Lido, Rocket Pool, Coinbase), savings rates (Maker DSR/sDAI), curated vaults (MetaMorpho, Yearn), fixed-yield (Pendle PT), and basis capture (Ethena sUSDe).
Returns opportunities ranked by APY with risk level, TVL, lockup period, and protocol details. Filter by asset, category, or risk tolerance. Pass tags=["fixed-yield"] to isolate fixed-rate PTs, or tags=["yt","leveraged-variable"] to surface Pendle YT markets (hidden by default).`;

const RISK_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3 };

const YT_TAGS = new Set(["yt", "leveraged-variable", "leveraged"]);

function wantsYT(tags: string[] | undefined): boolean {
  if (!tags || tags.length === 0) return false;
  return tags.some((t) => YT_TAGS.has(t.toLowerCase()));
}

export async function handleYieldOpportunities(params: {
  asset?: string;
  category?: string;
  riskTolerance?: string;
  tags?: string[];
}): Promise<Record<string, unknown>> {
  const asset = params.asset ?? "all";
  const category = params.category ?? "all";
  const maxRisk = RISK_ORDER[params.riskTolerance ?? "high"] ?? 3;
  const includeYT = wantsYT(params.tags);
  const requestedTags = (params.tags ?? []).map((t) => t.toLowerCase());

  const [lending, savings, staking, vaults, structured, metaMorpho, pendle] = await Promise.allSettled([
    getLendingSupplyYields(asset),
    getMakerDSRYield(),
    getStakingYields(),
    getVaultYields(),
    getStructuredYields(),
    getMetaMorphoYields(),
    getPendleYields(includeYT),
  ]);

  let allYields: YieldOpportunity[] = [
    ...(lending.status === "fulfilled" ? lending.value : []),
    ...(savings.status === "fulfilled" ? savings.value : []),
    ...(staking.status === "fulfilled" ? staking.value : []),
    ...(vaults.status === "fulfilled" ? vaults.value : []),
    ...(structured.status === "fulfilled" ? structured.value : []),
    ...(metaMorpho.status === "fulfilled" ? metaMorpho.value : []),
    ...(pendle.status === "fulfilled" ? pendle.value : []),
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

  if (requestedTags.length > 0) {
    allYields = allYields.filter((y) =>
      (y.tags ?? []).some((t) => requestedTags.includes(t.toLowerCase()))
    );
  }

  allYields = allYields.filter((y) => RISK_ORDER[y.risk] <= maxRisk);
  allYields.sort((a, b) => b.apy - a.apy);

  const byRisk = {
    low: allYields.filter((y) => y.risk === "low"),
    medium: allYields.filter((y) => y.risk === "medium"),
    high: allYields.filter((y) => y.risk === "high"),
  };

  const bestOverall = allYields[0] ?? null;
  const bestLowRisk = byRisk.low[0] ?? null;

  return {
    query: { asset, category, riskTolerance: params.riskTolerance ?? "high" },
    summary: {
      totalOpportunities: allYields.length,
      bestAPY: bestOverall
        ? { protocol: bestOverall.protocol, product: bestOverall.product, apy: round(bestOverall.apy), risk: bestOverall.risk }
        : null,
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
      ...(y.maturity ? { maturity: y.maturity } : {}),
      ...(y.tags && y.tags.length > 0 ? { tags: y.tags } : {}),
    })),
    timestamp: new Date().toISOString(),
    note: "All yields sourced from on-chain data. Yields marked 'estimated' will improve to trailing-7d accuracy as historical data accumulates (typically 24-48h after deployment). Variable rates change with market conditions. Higher APY generally correlates with higher risk.",
  };
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
