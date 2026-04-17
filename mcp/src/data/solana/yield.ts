import type { YieldOpportunity, ProtocolRate, Protocol } from "../types.js";
import { getKaminoMarkets } from "./kamino.js";
import { getMarginFiMarkets } from "./marginfi.js";
import { getJitoStakingRate } from "./jito.js";
import { getMarinadeRate } from "./marinade.js";
import { getSanctumLSTs } from "./sanctum.js";
import { getDriftYields } from "./drift.js";

function normalizeMarketToYield(
  m: Awaited<ReturnType<typeof getKaminoMarkets>>[number],
): YieldOpportunity {
  return {
    protocol: m.protocol,
    product: m.market,
    asset: m.asset,
    apy: m.supplyAPY,
    apyType: "variable",
    tvlUSD: m.tvlUSD,
    category: "lending-supply",
    risk: "medium",
    riskNotes: `${m.protocol} Solana lending. Variable rate — changes with utilization.`,
    lockup: "none",
    lastUpdated: new Date().toISOString(),
  };
}

export async function getSolanaYields(): Promise<YieldOpportunity[]> {
  const [kamino, marginfi, jito, marinade, sanctum, drift] = await Promise.allSettled([
    getKaminoMarkets(),
    getMarginFiMarkets(),
    getJitoStakingRate(),
    getMarinadeRate(),
    getSanctumLSTs(),
    getDriftYields(),
  ]);

  const out: YieldOpportunity[] = [];
  const now = new Date().toISOString();

  if (kamino.status === "fulfilled") {
    for (const m of kamino.value) out.push(normalizeMarketToYield(m));
  }
  if (marginfi.status === "fulfilled") {
    for (const m of marginfi.value) out.push(normalizeMarketToYield(m));
  }
  if (jito.status === "fulfilled" && jito.value) {
    out.push({
      protocol: "jito",
      product: "jitoSOL",
      asset: "SOL",
      apy: jito.value.apy,
      apyType: "variable",
      tvlUSD: jito.value.tvlUSD,
      category: "liquid-staking",
      risk: "low",
      riskNotes: "Solana liquid-staking via Jito stake pool. MEV rewards included. LST tradable on Jupiter.",
      lockup: "none (liquid)",
      lastUpdated: now,
    });
  }
  if (marinade.status === "fulfilled" && marinade.value) {
    out.push({
      protocol: "marinade",
      product: "mSOL",
      asset: "SOL",
      apy: marinade.value.apy,
      apyType: "variable",
      tvlUSD: marinade.value.tvlUSD,
      category: "liquid-staking",
      risk: "low",
      riskNotes: "Solana liquid-staking via Marinade. LST tradable on Jupiter.",
      lockup: "none (liquid)",
      lastUpdated: now,
    });
  }
  if (sanctum.status === "fulfilled") {
    for (const lst of sanctum.value) {
      out.push({
        protocol: "sanctum",
        product: lst.product,
        asset: "SOL",
        apy: lst.apy,
        apyType: "variable",
        tvlUSD: lst.tvlUSD,
        category: "liquid-staking",
        risk: lst.product === "INF" ? "medium" : "low",
        riskNotes: `Sanctum LST (${lst.product}). ${lst.product === "INF" ? "INF is a multi-LST pool — depeg risk if a constituent LST delists." : "Standard Sanctum stake pool."}`,
        lockup: "none (liquid)",
        lastUpdated: now,
      });
    }
  }
  if (drift.status === "fulfilled") {
    for (const d of drift.value) {
      out.push({
        protocol: d.protocol,
        product: d.product,
        asset: d.asset,
        apy: d.apy,
        apyType: "variable",
        tvlUSD: d.tvlUSD,
        category: d.category,
        risk: d.category === "basis-capture" ? "high" : "medium",
        riskNotes: d.category === "basis-capture"
          ? "Drift insurance-fund staking — backstops liquidation losses; subject to drawdowns in volatile markets."
          : "Drift spot lending — variable rate, shared with perpetual collateral.",
        lockup: d.category === "basis-capture" ? "13-day cooldown" : "none",
        lastUpdated: now,
      });
    }
  }

  return out;
}

/**
 * Solana lending rates in the existing ProtocolRate shape.
 * Notes: `borrowAsset`, `liquidationThreshold`, `maxLTV`, etc. come from the per-reserve
 * market. Solana LTV/liquidation data varies across protocols and isn't provided
 * uniformly — we surface conservative defaults when not available.
 */
export async function getSolanaLendingRates(
  collateralFilter?: string,
  borrowAsset: string = "USDC",
): Promise<ProtocolRate[]> {
  const [kamino, marginfi] = await Promise.allSettled([
    getKaminoMarkets(),
    getMarginFiMarkets(),
  ]);

  const all = [
    ...(kamino.status === "fulfilled" ? kamino.value : []),
    ...(marginfi.status === "fulfilled" ? marginfi.value : []),
  ];

  const filtered = collateralFilter && collateralFilter !== "all"
    ? all.filter((m) => m.asset.toUpperCase() === collateralFilter.toUpperCase())
    : all;

  const now = new Date().toISOString();
  return filtered.map((m) => ({
    protocol: m.protocol as Protocol,
    chain: "solana",
    market: m.market,
    collateral: m.asset,
    borrowAsset,
    supplyAPY: m.supplyAPY,
    borrowAssetSupplyAPY: m.supplyAPY,
    borrowAPY: m.borrowAPY,
    availableLiquidity: m.liquidityUSD,
    availableLiquidityUSD: m.liquidityUSD,
    totalSupply: m.tvlUSD,
    totalBorrow: Math.max(m.tvlUSD - m.liquidityUSD, 0),
    utilization: m.utilization,
    maxLTV: 0,
    liquidationThreshold: 0,
    liquidationPenalty: 0,
    lastUpdated: now,
  }));
}
