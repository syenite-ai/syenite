import { getAaveRates, getSparkRates } from "../data/aave.js";
import { getMorphoRates } from "../data/morpho.js";
import { getCompoundRates } from "../data/compound.js";
import { getFluidRates } from "../data/fluid.js";
import { getSolanaLendingRates } from "../data/solana/yield.js";
import type { SupportedChain } from "../data/client.js";
import type { ProtocolRate } from "../data/types.js";

export const ratesToolName = "lending.rates.query";

export const ratesToolDescription = `Query real-time DeFi lending rates across Aave v3, Compound V3, Fluid, Morpho Blue, and Spark on Ethereum, Arbitrum, and Base; plus Kamino and MarginFi on Solana.
Returns normalized borrow APY, supply APY, available liquidity, utilization, and LTV limits for each market.
Supports all major collateral types: BTC wrappers (wBTC, tBTC, cbBTC), ETH and LSTs (WETH, wstETH, rETH, cbETH, weETH), SOL and LSTs (SOL, mSOL, jitoSOL).
Filter by specific asset, category ("BTC" or "ETH"), chain ("ethereum", "arbitrum", "base", "bsc", "solana"), or use "all".`;

export async function handleRatesQuery(params: {
  collateral?: string;
  borrowAsset?: string;
  chain?: string;
}): Promise<Record<string, unknown>> {
  const collateral = params.collateral ?? "all";
  const borrowAsset = params.borrowAsset ?? "USDC";
  const chainParam = params.chain?.toLowerCase();
  const solanaOnly = chainParam === "solana";
  const includeSolana = !chainParam || chainParam === "all" || solanaOnly;
  const includeEvm = !solanaOnly;

  const evmChains = chainParam && chainParam !== "all" && chainParam !== "solana"
    ? [chainParam as SupportedChain]
    : undefined;

  const evmTasks = includeEvm
    ? [
        getAaveRates(collateral, borrowAsset, evmChains),
        getMorphoRates(collateral, borrowAsset),
        getSparkRates(collateral, borrowAsset, evmChains),
        getCompoundRates(collateral, borrowAsset, evmChains),
        getFluidRates(collateral, borrowAsset, evmChains),
      ]
    : [];
  const solanaTasks = includeSolana
    ? [getSolanaLendingRates(collateral, borrowAsset)]
    : [];

  const results = await Promise.allSettled([...evmTasks, ...solanaTasks]);

  const allRates: ProtocolRate[] = results.flatMap((r) =>
    r.status === "fulfilled" ? (r.value as ProtocolRate[]) : [],
  );

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
