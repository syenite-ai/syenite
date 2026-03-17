import { getAaveRates, getSparkRates } from "../data/aave.js";
import { getMorphoRates } from "../data/morpho.js";
import type { ProtocolRate } from "../data/types.js";

export const ratesToolName = "lending.rates.query";

export const ratesToolDescription = `Query real-time DeFi lending rates across Aave v3 and Morpho Blue on Ethereum mainnet.
Returns normalized borrow APY, supply APY, available liquidity, utilization, and LTV limits for each market.
Supports all major collateral types: BTC wrappers (wBTC, tBTC, cbBTC), ETH and LSTs (WETH, wstETH, rETH, cbETH, weETH). Filter by specific asset, category ("BTC" or "ETH"), or use "all".`;

export const ratesToolSchema = {
  collateral: {
    type: "string" as const,
    description:
      'BTC wrapper to query: "wBTC", "tBTC", "cbBTC", or "all" (default). Returns rates for each wrapper on each protocol.',
  },
  borrowAsset: {
    type: "string" as const,
    description: 'Stablecoin to borrow against BTC collateral. Default "USDC".',
  },
};

export async function handleRatesQuery(params: {
  collateral?: string;
  borrowAsset?: string;
}): Promise<string> {
  const collateral = params.collateral ?? "all";
  const borrowAsset = params.borrowAsset ?? "USDC";

  const [aaveRates, morphoRates, sparkRates] = await Promise.allSettled([
    getAaveRates(collateral, borrowAsset),
    getMorphoRates(collateral, borrowAsset),
    getSparkRates(collateral, borrowAsset),
  ]);

  const allRates: ProtocolRate[] = [
    ...(aaveRates.status === "fulfilled" ? aaveRates.value : []),
    ...(morphoRates.status === "fulfilled" ? morphoRates.value : []),
    ...(sparkRates.status === "fulfilled" ? sparkRates.value : []),
  ];

  if (allRates.length === 0) {
    return JSON.stringify({
      status: "no_markets",
      message: `No active lending markets found for collateral=${collateral}, borrowAsset=${borrowAsset}`,
    });
  }

  const bestBorrow = allRates.reduce((best, r) =>
    r.borrowAPY < best.borrowAPY ? r : best
  );

  return JSON.stringify({
    query: { collateral, borrowAsset },
    bestBorrowRate: {
      protocol: bestBorrow.protocol,
      market: bestBorrow.market,
      borrowAPY: round(bestBorrow.borrowAPY),
    },
    markets: allRates.map((r) => ({
      protocol: r.protocol,
      market: r.market,
      collateral: r.collateral,
      borrowAPY: round(r.borrowAPY),
      supplyAPY: round(r.supplyAPY),
      availableLiquidityUSD: round(r.availableLiquidityUSD),
      utilization: round(r.utilization),
      maxLTV: round(r.maxLTV),
      liquidationThreshold: round(r.liquidationThreshold),
    })),
    timestamp: new Date().toISOString(),
    note: "Rates are real-time from on-chain data. APYs include compounding. Liquidity figures are current available amounts, not TVL.",
  });
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
