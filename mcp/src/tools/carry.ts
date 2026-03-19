import { getAaveRates, getSparkRates } from "../data/aave.js";
import { getMorphoRates } from "../data/morpho.js";
import { getCompoundRates } from "../data/compound.js";
import { getFluidRates } from "../data/fluid.js";
import type { SupportedChain } from "../data/client.js";
import type { ProtocolRate } from "../data/types.js";

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

  const [aave, morpho, spark, compound, fluid] = await Promise.allSettled([
    getAaveRates(collateral, borrowAsset, chains),
    getMorphoRates(collateral, borrowAsset),
    getSparkRates(collateral, borrowAsset, chains),
    getCompoundRates(collateral, borrowAsset, chains),
    getFluidRates(collateral, borrowAsset, chains),
  ]);

  const allRates: ProtocolRate[] = [
    ...(aave.status === "fulfilled" ? aave.value : []),
    ...(morpho.status === "fulfilled" ? morpho.value : []),
    ...(spark.status === "fulfilled" ? spark.value : []),
    ...(compound.status === "fulfilled" ? compound.value : []),
    ...(fluid.status === "fulfilled" ? fluid.value : []),
  ];

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
    })
    .filter((s) => s.netCarry >= minCarry)
    .sort((a, b) => b.netCarry - a.netCarry);

  const positiveCarry = strategies.filter((s) => s.netCarry > 0);
  const bestStrategy = strategies[0] ?? null;

  return {
    query: { collateral, borrowAsset, chain: params.chain ?? "all", minCarry: params.minCarry, positionSizeUSD: positionSize },
    summary: {
      totalMarketsScanned: allRates.length,
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
    strategies: strategies.map((s) => ({
      ...s,
      estimatedAnnualReturnUSD: round(positionSize * (s.netCarry / 100)),
    })),
    timestamp: new Date().toISOString(),
    note: `Net carry = supply APY - borrow APY. Leveraged carry assumes safe LTV at 70% of max. Annual return calculated on ${positionSize.toLocaleString()} USD position.`,
  };
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
