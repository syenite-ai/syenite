import { getAaveRates } from "../data/aave.js";
import { getMorphoRates } from "../data/morpho.js";
import type { ProtocolRate } from "../data/types.js";

export const marketToolName = "lending.market.overview";

export const marketToolDescription = `Get an aggregate overview of BTC lending markets across Aave v3 and Morpho Blue on Ethereum mainnet.
Returns per-protocol totals: TVL, total borrowed, utilization ranges, rate ranges, and available liquidity.
Use this for a high-level view of where BTC lending capital is deployed and what conditions look like.`;

export const marketToolSchema = {
  collateral: {
    type: "string" as const,
    description:
      'Filter by BTC wrapper: "wBTC", "tBTC", "cbBTC", or "all" (default).',
  },
};

export async function handleMarketOverview(params: {
  collateral?: string;
}): Promise<string> {
  const collateral = params.collateral ?? "all";

  const [aaveRates, morphoRates] = await Promise.all([
    getAaveRates(collateral),
    getMorphoRates(collateral),
  ]);

  const allRates = [...aaveRates, ...morphoRates];

  if (allRates.length === 0) {
    return JSON.stringify({
      status: "no_markets",
      message: `No active BTC lending markets found for collateral=${collateral}`,
    });
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

  return JSON.stringify({
    query: { collateral },
    crossProtocol,
    protocols,
    timestamp: new Date().toISOString(),
  });
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
