import { formatEther, formatGwei } from "viem";
import { getClient, ALL_LENDING_CHAINS, type SupportedChain } from "../data/client.js";
import { getRecentPrioritizationFees } from "../data/solana/client.js";
import { SyeniteError } from "../errors.js";
import { log } from "../logging/logger.js";

export const gasEstimateDescription = `Estimate current gas costs across supported chains (Ethereum, Arbitrum, Base, BNB Chain) and Solana priority fees.
Returns gas prices, estimated costs for common operations (transfer, swap, bridge, contract call), and the native token needed.
For Solana, returns recent prioritization fees in micro-lamports/CU (sampled from the last few slots).
Use this before executing transactions to ensure the wallet has enough native gas, or to pick the cheapest chain for an operation.`;

const NATIVE_SYMBOLS: Record<SupportedChain, string> = {
  ethereum: "ETH",
  arbitrum: "ETH",
  base: "ETH",
  bsc: "BNB",
};

// Typical gas units for common DeFi operations
const GAS_ESTIMATES: Record<string, number> = {
  transfer: 21_000,
  erc20_transfer: 65_000,
  swap: 200_000,
  bridge: 350_000,
  erc20_approve: 46_000,
  lending_supply: 300_000,
  lending_borrow: 350_000,
  contract_register: 250_000,
};

interface ChainGas {
  chain: string;
  nativeSymbol: string;
  gasPrice: { gwei: string; wei: string };
  operations: Record<string, { gasUnits: number; costNative: string; costApproxUSD: string }>;
}

// Rough native token USD prices — updated periodically in practice
// For a production system these would come from price feeds
async function getNativePrice(chain: SupportedChain): Promise<number> {
  if (chain === "bsc") return 600;
  return 2000;
}

export async function handleGasEstimate(params: {
  chains?: string[];
  operations?: string[];
}): Promise<Record<string, unknown>> {
  const lowerChains = params.chains?.map((c) => c.toLowerCase()) ?? [];
  const solanaRequested = lowerChains.includes("solana");
  const requestedChains = lowerChains.length > 0
    ? lowerChains.filter((c): c is SupportedChain => ALL_LENDING_CHAINS.includes(c as SupportedChain))
    : ALL_LENDING_CHAINS;

  if (requestedChains.length === 0 && !solanaRequested) {
    throw SyeniteError.invalidInput(`No valid chains. Supported: ${ALL_LENDING_CHAINS.join(", ")}, solana`);
  }

  const requestedOps = params.operations?.length
    ? params.operations.filter((op) => op in GAS_ESTIMATES)
    : Object.keys(GAS_ESTIMATES);

  const chainResults = await Promise.allSettled(
    requestedChains.map((chain) => fetchChainGas(chain, requestedOps))
  );

  const estimates: ChainGas[] = [];
  for (let i = 0; i < requestedChains.length; i++) {
    const result = chainResults[i];
    if (result.status === "fulfilled") {
      estimates.push(result.value);
    } else {
      log.warn("Gas estimate failed", { chain: requestedChains[i], error: (result.reason as Error).message });
    }
  }

  // Find cheapest chain per operation
  const cheapest: Record<string, { chain: string; costUSD: string }> = {};
  for (const op of requestedOps) {
    let best: { chain: string; cost: number } | null = null;
    for (const est of estimates) {
      const opData = est.operations[op];
      if (opData) {
        const costUSD = parseFloat(opData.costApproxUSD.replace("$", ""));
        if (!best || costUSD < best.cost) {
          best = { chain: est.chain, cost: costUSD };
        }
      }
    }
    if (best) {
      cheapest[op] = { chain: best.chain, costUSD: `$${best.cost.toFixed(4)}` };
    }
  }

  const chainsQueried: string[] = [...requestedChains];
  let solanaBlock: Record<string, unknown> | null = null;
  if (solanaRequested) {
    solanaBlock = await fetchSolanaGas();
    chainsQueried.push("solana");
  }

  const result: Record<string, unknown> = {
    chainsQueried,
    estimates,
    cheapestChain: cheapest,
    availableOperations: Object.keys(GAS_ESTIMATES),
    timestamp: new Date().toISOString(),
    note: "Gas prices are current on-chain values. USD estimates use approximate native token prices. For Solana, prioritization fees are reported in micro-lamports per compute unit (µLamports/CU). Actual costs vary with transaction complexity. — syenite.ai",
  };

  if (solanaBlock) result.solana = solanaBlock;

  return result;
}

async function fetchSolanaGas(): Promise<Record<string, unknown>> {
  const fees = await getRecentPrioritizationFees();
  if (fees.length === 0) {
    return {
      chain: "solana",
      nativeSymbol: "SOL",
      priorityFeeMicroLamports: { min: 0, median: 0, p75: 0, max: 0, samples: 0 },
      note: "No recent prioritization fee data available. Default priority fee of 0 µLamports/CU is safe for low-traffic slots; raise during congestion.",
    };
  }
  const sorted = [...fees].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))];
  return {
    chain: "solana",
    nativeSymbol: "SOL",
    priorityFeeMicroLamports: {
      min: sorted[0],
      median: pct(0.5),
      p75: pct(0.75),
      max: sorted[sorted.length - 1],
      samples: sorted.length,
    },
    note: "Values in µLamports/CU from getRecentPrioritizationFees RPC. Multiply by your tx compute-unit limit (typically 200k–1.4M CU) and divide by 1e6 to get total lamports; divide by 1e9 for SOL.",
  };
}

async function fetchChainGas(chain: SupportedChain, operations: string[]): Promise<ChainGas> {
  const client = getClient(chain);
  const gasPrice = await client.getGasPrice();
  const nativePrice = await getNativePrice(chain);

  const ops: ChainGas["operations"] = {};
  for (const op of operations) {
    const gasUnits = GAS_ESTIMATES[op];
    if (!gasUnits) continue;
    const costWei = gasPrice * BigInt(gasUnits);
    const costNative = parseFloat(formatEther(costWei));
    const costUSD = costNative * nativePrice;
    ops[op] = {
      gasUnits,
      costNative: `${costNative.toFixed(8)} ${NATIVE_SYMBOLS[chain]}`,
      costApproxUSD: `$${costUSD.toFixed(4)}`,
    };
  }

  return {
    chain,
    nativeSymbol: NATIVE_SYMBOLS[chain],
    gasPrice: {
      gwei: formatGwei(gasPrice),
      wei: gasPrice.toString(),
    },
    operations: ops,
  };
}
