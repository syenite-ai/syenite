import { getAaveRates, getSparkRates } from "../data/aave.js";
import { getMorphoRates } from "../data/morpho.js";
import { getCompoundRates } from "../data/compound.js";
import { getFluidRates } from "../data/fluid.js";
import type { SupportedChain } from "../data/client.js";
import type { ProtocolRate } from "../data/types.js";

export const marketToolName = "lending.market.overview";

export const marketToolDescription = `Returns an aggregated overview of DeFi lending market conditions across Aave v3, Compound V3, Fluid, Morpho Blue, and Spark on Ethereum, Arbitrum, and Base.
Use this for a macro view of the lending landscape before calling \`lending.rates.query\` for per-market detail — it surfaces cross-protocol totals for supply, borrow, utilization, and available liquidity alongside borrow and supply APY ranges per protocol.
Pass \`collateral\` (e.g. "ETH", "BTC", or "all") to scope the market scan; optionally pass \`chain\` to restrict to one network.
Returns cross-protocol summary (lowest borrow APY, highest supply APY, total available liquidity) and per-protocol breakdowns including individual market rows; does not execute any transaction.`;

export async function handleMarketOverview(params: {
  collateral?: string;
  chain?: string;
}): Promise<Record<string, unknown>> {
  const collateral = params.collateral ?? "all";
  const chains = params.chain && params.chain !== "all"
    ? [params.chain as SupportedChain]
    : undefined;

  const [aaveRates, morphoRates, sparkRates, compoundRates, fluidRates] = await Promise.allSettled([
    getAaveRates(collateral, undefined, chains),
    getMorphoRates(collateral),
    getSparkRates(collateral, undefined, chains),
    getCompoundRates(collateral, undefined, chains),
    getFluidRates(collateral, undefined, chains),
  ]);

  const allRates = [
    ...(aaveRates.status === "fulfilled" ? aaveRates.value : []),
    ...(morphoRates.status === "fulfilled" ? morphoRates.value : []),
    ...(sparkRates.status === "fulfilled" ? sparkRates.value : []),
    ...(compoundRates.status === "fulfilled" ? compoundRates.value : []),
    ...(fluidRates.status === "fulfilled" ? fluidRates.value : []),
  ];

  if (allRates.length === 0) {
    return {
      query: { collateral },
      crossProtocol: {
        totalMarketsScanned: 0,
        lowestBorrowAPY: 0,
        highestSupplyAPY: 0,
        totalAvailableLiquidityUSD: 0,
      },
      protocols: [],
      timestamp: new Date().toISOString(),
    };
  }

  const byProtocol = groupBy(allRates, (r) => r.protocol);
  const protocols = Object.entries(byProtocol).map(([protocol, markets]) => {
    const totalSupplyUSD = markets.reduce(
      (sum, m) => sum + m.availableLiquidityUSD + m.totalBorrow,
      0
    );
    const totalBorrowUSD = markets.reduce(
      (sum, m) => sum + m.totalBorrow,
      0
    );
    const borrowRates = markets.map((m) => m.borrowAPY);
    const supplyRates = markets.map((m) => m.supplyAPY);

    return {
      protocol,
      marketCount: markets.length,
      totalSupplyUSD: round(totalSupplyUSD),
      totalBorrowUSD: round(totalBorrowUSD),
      availableLiquidityUSD: round(totalSupplyUSD - totalBorrowUSD),
      utilization: round(
        totalSupplyUSD > 0 ? (totalBorrowUSD / totalSupplyUSD) * 100 : 0
      ),
      borrowAPYRange: {
        min: round(Math.min(...borrowRates)),
        max: round(Math.max(...borrowRates)),
      },
      supplyAPYRange: {
        min: round(Math.min(...supplyRates)),
        max: round(Math.max(...supplyRates)),
      },
      markets: markets.map((m) => ({
        market: m.market,
        collateral: m.collateral,
        borrowAPY: round(m.borrowAPY),
        supplyAPY: round(m.supplyAPY),
        utilization: round(m.utilization),
        availableLiquidityUSD: round(m.availableLiquidityUSD),
        liquidationPenalty: round(m.liquidationPenalty),
      })),
    };
  });

  const crossProtocol = {
    totalMarketsScanned: allRates.length,
    lowestBorrowAPY: round(Math.min(...allRates.map((r) => r.borrowAPY))),
    highestSupplyAPY: round(Math.max(...allRates.map((r) => r.supplyAPY))),
    totalAvailableLiquidityUSD: round(
      allRates.reduce((sum, r) => sum + r.availableLiquidityUSD, 0)
    ),
  };

  return {
    query: { collateral },
    crossProtocol,
    protocols,
    timestamp: new Date().toISOString(),
  };
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    (result[key] ??= []).push(item);
  }
  return result;
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
