import { getAaveRates, getSparkRates } from "../data/aave.js";
import { getMorphoRatesMultiChain } from "../data/morpho.js";
import { getCompoundRates } from "../data/compound.js";
import { getFluidRates } from "../data/fluid.js";
import { getPendleMarkets } from "../data/pendle.js";
import type { SupportedChain } from "../data/client.js";
import type { ProtocolRate, PendleMarket } from "../data/types.js";

export const carryScreenerDescription = `Screen for positive carry strategies across all DeFi lending markets.
Calculates net carry = collateral supply APY - borrow APY for every market.
Returns strategies ranked by carry, including net annual return on a given position size.
Positive carry means you earn more on deposited collateral than you pay to borrow — a self-funding leveraged position.
Use this to discover the best borrow-to-yield strategies for autonomous agents.`;

interface CarryStrategy {
  protocol: string;
  chain: string;
  market: string;
  collateral: string;
  borrowAsset: string;
  supplyAPY: number;
  borrowAPY: number;
  netCarry: number;
  maxLTV: number;
  leveragedCarry: number;
  liquidationPenalty: number;
  availableLiquidityUSD: number;
  utilization: number;
}

export async function handleCarryScreener(params: {
  collateral?: string;
  borrowAsset?: string;
  chain?: string;
  minCarry?: number;
  positionSizeUSD?: number;
}): Promise<Record<string, unknown>> {
  const collateral = params.collateral ?? "all";
  const borrowAsset = params.borrowAsset ?? "USDC";
  const chains = params.chain && params.chain !== "all"
    ? [params.chain as SupportedChain]
    : undefined;
  const minCarry = params.minCarry ?? -Infinity;
  const positionSize = params.positionSizeUSD ?? 100_000;

  const [aave, morpho, spark, compound, fluid, pendle] = await Promise.allSettled([
    getAaveRates(collateral, borrowAsset, chains),
    getMorphoRatesMultiChain(collateral, borrowAsset, chains),
    getSparkRates(collateral, borrowAsset, chains),
    getCompoundRates(collateral, borrowAsset, chains),
    getFluidRates(collateral, borrowAsset, chains),
    getPendleMarkets({}),
  ]);

  const allRates: ProtocolRate[] = [
    ...(aave.status === "fulfilled" ? aave.value : []),
    ...(morpho.status === "fulfilled" ? morpho.value : []),
    ...(spark.status === "fulfilled" ? spark.value : []),
    ...(compound.status === "fulfilled" ? compound.value : []),
    ...(fluid.status === "fulfilled" ? fluid.value : []),
  ];
  const pendleMarkets: PendleMarket[] = pendle.status === "fulfilled" ? pendle.value : [];

  const strategies: CarryStrategy[] = allRates
    .map((r) => {
      const netCarry = r.supplyAPY - r.borrowAPY;
      // Leveraged carry at safe LTV (70% of max)
      const safeLTV = r.maxLTV * 0.7 / 100;
      const leverage = safeLTV > 0 ? 1 / (1 - safeLTV) : 1;
      const leveragedCarry = netCarry * leverage;

      return {
        protocol: r.protocol,
        chain: r.chain,
        market: r.market,
        collateral: r.collateral,
        borrowAsset: r.borrowAsset,
        supplyAPY: round(r.supplyAPY),
        borrowAPY: round(r.borrowAPY),
        netCarry: round(netCarry),
        maxLTV: round(r.maxLTV),
        leveragedCarry: round(leveragedCarry),
        liquidationPenalty: round(r.liquidationPenalty),
        availableLiquidityUSD: round(r.availableLiquidityUSD),
        utilization: round(r.utilization),
      };
    });

  // Cheapest per-chain borrow rate for the requested borrow asset — drives Pendle carry.
  const cheapestBorrow = new Map<string, { apy: number; liquidity: number }>();
  for (const r of allRates) {
    if (r.borrowAsset !== borrowAsset) continue;
    const prev = cheapestBorrow.get(r.chain);
    if (!prev || r.borrowAPY < prev.apy) {
      cheapestBorrow.set(r.chain, { apy: r.borrowAPY, liquidity: r.availableLiquidityUSD });
    }
  }

  for (const pm of pendleMarkets) {
    if (pm.ptFixedAPY <= 0) continue;
    const borrow = cheapestBorrow.get(pm.chain);
    if (!borrow) continue;
    const netCarry = pm.ptFixedAPY - borrow.apy;
    const maturityLabel = pm.maturity.slice(0, 10);
    strategies.push({
      protocol: "pendle",
      chain: pm.chain,
      market: `Pendle PT-${pm.underlying} vs cheapest ${borrowAsset} borrow (matures ${maturityLabel})`,
      collateral: `PT-${pm.underlying}`,
      borrowAsset,
      supplyAPY: round(pm.ptFixedAPY),
      borrowAPY: round(borrow.apy),
      netCarry: round(netCarry),
      maxLTV: 0,
      leveragedCarry: round(netCarry),
      liquidationPenalty: 0,
      availableLiquidityUSD: round(Math.min(pm.liquidityUSD, borrow.liquidity)),
      utilization: 0,
    });
  }

  strategies.sort((a, b) => b.netCarry - a.netCarry);
  const filtered = strategies.filter((s) => s.netCarry >= minCarry);

  const positiveCarry = filtered.filter((s) => s.netCarry > 0);
  const bestStrategy = filtered[0] ?? null;

  return {
    query: { collateral, borrowAsset, chain: params.chain ?? "all", minCarry: params.minCarry, positionSizeUSD: positionSize },
    summary: {
      totalMarketsScanned: allRates.length + pendleMarkets.length,
      positiveCarryCount: positiveCarry.length,
      bestCarry: bestStrategy
        ? {
            market: bestStrategy.market,
            netCarry: bestStrategy.netCarry,
            leveragedCarry: bestStrategy.leveragedCarry,
            estimatedAnnualReturnUSD: round(positionSize * (bestStrategy.netCarry / 100)),
          }
        : null,
    },
    strategies: filtered.map((s) => ({
      ...s,
      estimatedAnnualReturnUSD: round(positionSize * (s.netCarry / 100)),
    })),
    timestamp: new Date().toISOString(),
    note: `Net carry = supply APY - borrow APY. For Pendle PT rows, supply APY is PT fixed yield and borrow APY is the cheapest same-chain ${borrowAsset} borrow. Leveraged carry assumes safe LTV at 70% of max. Annual return calculated on ${positionSize.toLocaleString()} USD position.`,
  };
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
