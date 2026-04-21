import { getAaveRates, getSparkRates } from "../data/aave.js";
import { getMorphoRatesMultiChain } from "../data/morpho.js";
import { getCompoundRates } from "../data/compound.js";
import { getFluidRates } from "../data/fluid.js";
import { getSolanaLendingRates } from "../data/solana/yield.js";
import type { SupportedChain } from "../data/client.js";
import type { ProtocolRate } from "../data/types.js";

export const ratesToolName = "lending.rates.query";

export const ratesToolDescription = `Returns real-time borrow APY, supply APY, available liquidity, utilization, max LTV, liquidation threshold, and liquidation penalty for every active lending market across Aave v3, Compound V3, Fluid, Morpho Blue, and Spark on Ethereum, Arbitrum, and Base, plus Kamino and MarginFi on Solana.
Call this before any borrow or supply decision to identify the cheapest borrow or the highest supply rate for a given asset pair; the response includes a \`bestBorrowRate\` summary field for quick comparison.
Pass \`collateral\` (e.g. "WBTC", "ETH", "wstETH") and \`borrowAsset\` (e.g. "USDC", "DAI") to filter by pair; pass \`chain\` ("ethereum", "arbitrum", "base", "solana", or "all") to restrict scope — omitting either returns all markets.
This tool is read-only and executes no transactions; APYs include compounding and are sourced live from on-chain data.`;

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
        getMorphoRatesMultiChain(collateral, borrowAsset, evmChains),
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
