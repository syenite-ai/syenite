import { getLendingSupplyYields } from "../data/yield-lending.js";
import { getMakerDSRYield } from "../data/yield-savings.js";
import { getStakingYields } from "../data/yield-staking.js";
import { getVaultYields } from "../data/yield-vaults.js";
import { getStructuredYields } from "../data/yield-structured.js";
import { getSolanaYields } from "../data/solana/yield.js";
import type { YieldOpportunity } from "../data/types.js";

export const yieldToolName = "yield.opportunities";

export const yieldToolDescription = `Find the best DeFi yield opportunities for any asset across blue-chip protocols on Ethereum and Solana.
Aggregates yields from EVM lending supply (Aave, Morpho, Spark), liquid staking (Lido, Rocket Pool, Coinbase), savings rates (Maker DSR/sDAI), vaults (MetaMorpho, Yearn), and basis capture (Ethena sUSDe); and from Solana lending (Kamino, MarginFi), liquid staking (Jito, Marinade, Sanctum), and basis capture (Drift).
Pass chains: ["ethereum"], ["solana"], or both. Returns opportunities ranked by APY with risk level, TVL, lockup period, and protocol details. Filter by asset, category, or risk tolerance.`;

const RISK_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3 };

const EVM_CHAINS = new Set([
  "ethereum", "arbitrum", "base", "bsc", "optimism", "polygon", "avalanche", "linea", "scroll", "gnosis", "fantom", "zksync",
]);

function pickChains(chains: string[] | undefined): { includeEvm: boolean; includeSolana: boolean } {
  if (!chains || chains.length === 0) return { includeEvm: true, includeSolana: false };
  const lower = chains.map((c) => c.toLowerCase());
  return {
    includeEvm: lower.some((c) => EVM_CHAINS.has(c)),
    includeSolana: lower.includes("solana"),
  };
}

export async function handleYieldOpportunities(params: {
  asset?: string;
  category?: string;
  riskTolerance?: string;
  chains?: string[];
}): Promise<Record<string, unknown>> {
  const asset = params.asset ?? "all";
  const category = params.category ?? "all";
  const maxRisk = RISK_ORDER[params.riskTolerance ?? "high"] ?? 3;
  const { includeEvm, includeSolana } = pickChains(params.chains);

  const evmTasks = includeEvm
    ? [
        getLendingSupplyYields(asset),
        getMakerDSRYield(),
        getStakingYields(),
        getVaultYields(),
        getStructuredYields(),
      ]
    : [];
  const solanaTask = includeSolana ? [getSolanaYields()] : [];
  const results = await Promise.allSettled([...evmTasks, ...solanaTask]);

  let allYields: YieldOpportunity[] = results.flatMap((r) =>
    r.status === "fulfilled" ? (r.value as YieldOpportunity[]) : [],
  );

  if (asset && asset !== "all") {
    const filter = asset.toLowerCase();
    allYields = allYields.filter((y) => {
      const yAsset = y.asset.toLowerCase();
      if (yAsset === filter) return true;
      if (filter === "eth" && ["eth", "weth"].includes(yAsset)) return true;
      if (filter === "sol" && ["sol", "wsol", "msol", "jitosol", "bsol", "jupsol", "hsol", "inf"].includes(yAsset)) return true;
      if (filter === "stables" && ["usdc", "usdt", "dai", "gho", "usde", "pyusd", "usds"].includes(yAsset)) return true;
      return false;
    });
  }

  if (category && category !== "all") {
    allYields = allYields.filter((y) => y.category === category);
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
    })),
    timestamp: new Date().toISOString(),
    note: "All yields sourced from on-chain data. Yields marked 'estimated' will improve to trailing-7d accuracy as historical data accumulates (typically 24-48h after deployment). Variable rates change with market conditions. Higher APY generally correlates with higher risk.",
  };
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
