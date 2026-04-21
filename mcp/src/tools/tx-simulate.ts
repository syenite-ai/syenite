import { formatEther, formatUnits, erc20Abi, type Address, type Hex } from "viem";
import { getClient, type SupportedChain } from "../data/client.js";
import { CHAIN_IDS, CHAIN_NAMES } from "../data/types.js";
import { SyeniteError } from "../errors.js";
import { log } from "../logging/logger.js";

export const txSimulateDescription = `Simulates an unsigned EVM transaction against live chain state using eth_call and eth_estimateGas, returning whether the call would succeed or revert (with revert reason), estimated gas units, approximate gas cost in USD, and native token balance changes from the transaction value. Use this to independently verify what a transaction will do before signing — particularly useful when the transaction was constructed by a third party. Requires transaction.to, transaction.from, transaction.data, and optionally transaction.value and transaction.chainId; pass chain or chainId to target a specific network (ethereum, arbitrum, base, bsc supported). Does not submit the transaction; ERC-20 balance diffs require trace-level simulation (not available on public RPCs) and are noted but not fully computed.`;

const COMMON_TOKENS: Record<number, Array<{ symbol: string; address: Address; decimals: number }>> = {
  1: [
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
  ],
  42161: [
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
  ],
  8453: [
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  ],
  56: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  ],
};

function resolveChain(chainInput: string | number): { name: SupportedChain; id: number } {
  if (typeof chainInput === "number") {
    const name = CHAIN_NAMES[chainInput];
    if (name && ["ethereum", "arbitrum", "base", "bsc"].includes(name)) {
      return { name: name as SupportedChain, id: chainInput };
    }
    throw SyeniteError.invalidInput(`Unsupported chainId: ${chainInput}`);
  }
  const lower = chainInput.toLowerCase();
  const id = CHAIN_IDS[lower];
  if (id && ["ethereum", "arbitrum", "base", "bsc"].includes(lower)) {
    return { name: lower as SupportedChain, id };
  }
  throw SyeniteError.invalidInput(`Unsupported chain: ${chainInput}. Supported: ethereum, arbitrum, base, bsc`);
}

interface BalanceChange {
  address: string;
  token: string;
  before: string;
  after: string;
  delta: string;
  direction: "inflow" | "outflow" | "none";
}

export async function handleTxSimulate(params: {
  transaction: { to: string; data: string; value?: string; from: string; chainId?: number };
  chain?: string;
}): Promise<Record<string, unknown>> {
  const tx = params.transaction;
  if (!tx.to || !tx.from) {
    throw SyeniteError.invalidInput("transaction.to and transaction.from are required");
  }

  const chainInput = params.chain ?? tx.chainId ?? "ethereum";
  const chain = resolveChain(chainInput);
  const client = getClient(chain.name);
  const from = tx.from as Address;
  const to = tx.to as Address;
  const value = tx.value ? BigInt(tx.value) : 0n;

  const blockNumber = await client.getBlockNumber();
  const tokens = COMMON_TOKENS[chain.id] ?? [];

  // Pre-simulation: read balances
  const [nativeBefore, ...tokensBefore] = await Promise.all([
    client.getBalance({ address: from }),
    ...tokens.map((t) =>
      client.readContract({
        address: t.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [from],
      }).catch(() => 0n)
    ),
  ]);

  // Simulate the transaction
  let success = true;
  let gasUsed = 0n;
  let revertReason: string | null = null;

  try {
    const callResult = await client.call({
      account: from,
      to,
      data: (tx.data || "0x") as Hex,
      value,
    });
    // If we get here, the call succeeded
    void callResult;
  } catch (e: unknown) {
    success = false;
    const err = e as Error;
    revertReason = err.message ?? "Unknown revert";

    if (revertReason.includes("allowance") || revertReason.includes("approve") || revertReason.includes("ERC20:")) {
      return {
        success: false,
        revertReason: "token_approval_required",
        detail: "The transaction reverted due to insufficient token allowance. Approve the spender first.",
        chain: chain.name,
        simulatedAtBlock: Number(blockNumber),
        timestamp: new Date().toISOString(),
        verification: `Simulated via eth_call against block ${blockNumber} on ${chain.name}. Deterministic and verifiable by any RPC node.`,
      };
    }
  }

  // Estimate gas separately (eth_estimateGas)
  try {
    gasUsed = await client.estimateGas({
      account: from,
      to,
      data: (tx.data || "0x") as Hex,
      value,
    });
  } catch {
    // If estimation fails, use a fallback
    gasUsed = 0n;
  }

  // Post-simulation: For a proper diff we need to use a trace or state override.
  // Since public RPCs don't support debug_traceCall, we estimate balance changes
  // from the tx value and known patterns.
  const balanceChanges: BalanceChange[] = [];

  // Native token change from value
  if (value > 0n) {
    const nativeAfterEstimate = nativeBefore - value;
    balanceChanges.push({
      address: from,
      token: chain.name === "bsc" ? "BNB" : "ETH",
      before: formatEther(nativeBefore),
      after: formatEther(nativeAfterEstimate > 0n ? nativeAfterEstimate : 0n),
      delta: `-${formatEther(value)}`,
      direction: "outflow",
    });
  }

  // Gas cost estimate
  const gasPrice = await client.getGasPrice().catch(() => 0n);
  const gasCostWei = gasUsed * gasPrice;
  const gasCostEth = parseFloat(formatEther(gasCostWei));
  const nativePrice = chain.name === "bsc" ? 600 : 2000;
  const gasCostUSD = gasCostEth * nativePrice;

  // Check if any known token balances will change (best effort via static analysis)
  // Full balance diffing requires archive node + state overrides, so we report
  // what we can determine from the tx structure
  const contractsCalled: string[] = [to];

  return {
    success,
    gasUsed: Number(gasUsed),
    gasEstimateUSD: `$${gasCostUSD.toFixed(4)}`,
    balanceChanges,
    contractsCalled,
    ...(revertReason && { revertReason }),
    chain: chain.name,
    simulatedAtBlock: Number(blockNumber),
    timestamp: new Date().toISOString(),
    verification: `Simulated via eth_call against block ${blockNumber} on ${chain.name}. Deterministic and verifiable by any RPC node.`,
    note: "Balance changes show native token outflow from tx value. Full ERC-20 diffs require trace-level simulation (Tenderly). Gas estimate is from eth_estimateGas. — syenite.ai",
  };
}
