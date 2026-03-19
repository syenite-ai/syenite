import { getAaveRates, getSparkRates } from "../data/aave.js";
import { getMorphoRates } from "../data/morpho.js";
import { getCompoundRates } from "../data/compound.js";
import { getFluidRates } from "../data/fluid.js";
import type { SupportedChain } from "../data/client.js";
import type { ProtocolRate } from "../data/types.js";

export const ratesToolName = "lending.rates.query";

export const ratesToolDescription = `Query real-time DeFi lending rates across Aave v3, Compound V3, Fluid, Morpho Blue, and Spark on Ethereum, Arbitrum, and Base.
Returns normalized borrow APY, supply APY, available liquidity, utilization, and LTV limits for each market.
Supports all major collateral types: BTC wrappers (wBTC, tBTC, cbBTC), ETH and LSTs (WETH, wstETH, rETH, cbETH, weETH).
Filter by specific asset, category ("BTC" or "ETH"), chain, or use "all".`;

export async function handleRatesQuery(params: {
  collateral?: string;
  borrowAsset?: string;
  chain?: string;
}): Promise<Record<string, unknown>> {
  const collateral = params.collateral ?? "all";
  const borrowAsset = params.borrowAsset ?? "USDC";
  const chains = params.chain && params.chain !== "all"
    ? [params.chain as SupportedChain]
    : undefined;

  const [aaveRates, morphoRates, sparkRates, compoundRates, fluidRates] = await Promise.allSettled([
    getAaveRates(collateral, borrowAsset, chains),
    getMorphoRates(collateral, borrowAsset),
    getSparkRates(collateral, borrowAsset, chains),
    getCompoundRates(collateral, borrowAsset, chains),
    getFluidRates(collateral, borrowAsset, chains),
  ]);

  const allRates: ProtocolRate[] = [
    ...(aaveRates.status === "fulfilled" ? aaveRates.value : []),
    ...(morphoRates.status === "fulfilled" ? morphoRates.value : []),
    ...(sparkRates.status === "fulfilled" ? sparkRates.value : []),
    ...(compoundRates.status === "fulfilled" ? compoundRates.value : []),
    ...(fluidRates.status === "fulfilled" ? fluidRates.value : []),
  ];

  const bestBorrow = allRates.length > 0
    ? allRates.reduce((best, r) => (r.borrowAPY < best.borrowAPY ? r : best))
    : null;

  return {
    query: { collateral, borrowAsset, chain: params.chain ?? "all" },
    bestBorrowRate: bestBorrow
      ? { protocol: bestBorrow.protocol, chain: bestBorrow.chain, market: bestBorrow.market, borrowAPY: round(bestBorrow.borrowAPY) }
      : null,
    markets: allRates.map((r) => ({
      protocol: r.protocol,
      chain: r.chain,
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
