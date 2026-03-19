import { getAaveRates, getSparkRates } from "../data/aave.js";
import { getMorphoRates } from "../data/morpho.js";
import type { ProtocolRate } from "../data/types.js";

export const ratesToolName = "lending.rates.query";

export const ratesToolDescription = `Query real-time DeFi lending rates across Aave v3, Morpho Blue, and Spark on Ethereum mainnet.
Returns normalized borrow APY, supply APY, available liquidity, utilization, and LTV limits for each market.
Supports all major collateral types: BTC wrappers (wBTC, tBTC, cbBTC), ETH and LSTs (WETH, wstETH, rETH, cbETH, weETH). Filter by specific asset, category ("BTC" or "ETH"), or use "all".`;

export async function handleRatesQuery(params: {
  collateral?: string;
  borrowAsset?: string;
}): Promise<Record<string, unknown>> {
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

  const bestBorrow = allRates.length > 0
    ? allRates.reduce((best, r) => (r.borrowAPY < best.borrowAPY ? r : best))
    : null;

  return {
    query: { collateral, borrowAsset },
    bestBorrowRate: bestBorrow
      ? { protocol: bestBorrow.protocol, market: bestBorrow.market, borrowAPY: round(bestBorrow.borrowAPY) }
      : null,
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
      liquidationPenalty: round(r.liquidationPenalty),
    })),
    timestamp: new Date().toISOString(),
    note: "Rates are real-time from on-chain data. APYs include compounding. Liquidity figures are current available amounts, not TVL.",
  };
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
