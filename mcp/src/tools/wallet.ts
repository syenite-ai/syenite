import { formatEther, formatUnits, erc20Abi, type Address } from "viem";
import { getClient, ALL_LENDING_CHAINS, type SupportedChain } from "../data/client.js";
import { fetchSolanaBalances } from "../data/solana/balances.js";
import { isSolanaAddress } from "../data/solana/client.js";
import { SyeniteError } from "../errors.js";
import { log } from "../logging/logger.js";

export const walletBalancesDescription = `Returns native gas token and major stablecoin balances for any EVM or Solana address across supported chains, reading directly from on-chain RPC with no third-party indexer dependency. Accepts an EVM 0x-address (queries Ethereum, Arbitrum, Base, BNB Chain, and Optimism) or a Solana base58 pubkey (queries native SOL and all non-zero SPL token accounts) — address format is detected automatically. Optionally pass chains to restrict the query to specific chains and reduce latency. Use this before executing swaps, bridges, or lending operations to confirm the wallet holds sufficient funds. Returns balances per chain with raw and human-readable amounts; chains with RPC errors are included with an error marker rather than silently dropped.`;

const NATIVE_SYMBOLS: Record<SupportedChain, string> = {
  ethereum: "ETH",
  arbitrum: "ETH",
  base: "ETH",
  bsc: "BNB",
  optimism: "ETH",
};

const STABLECOINS: Record<SupportedChain, Array<{ symbol: string; address: Address; decimals: number }>> = {
  ethereum: [
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  ],
  arbitrum: [
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
  ],
  base: [
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  ],
  bsc: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  ],
  optimism: [
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
  ],
};

interface ChainBalance {
  chain: string;
  native: { symbol: string; balance: string; balanceRaw: string };
  tokens: Array<{ symbol: string; balance: string; balanceRaw: string }>;
}

export async function handleWalletBalances(params: {
  address: string;
  chains?: string[];
}): Promise<Record<string, unknown>> {
  const address = params.address;
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address);
  const isSolana = !isEvm && isSolanaAddress(address);

  if (!isEvm && !isSolana) {
    throw SyeniteError.invalidInput("Invalid address. Expected EVM 0x-address (42 chars) or Solana base58 pubkey.");
  }

  const requestedChainsLower = params.chains?.map((c) => c.toLowerCase()) ?? [];
  const solanaRequested =
    requestedChainsLower.includes("solana") || (isSolana && requestedChainsLower.length === 0);
  const evmRequested = isEvm && (requestedChainsLower.length === 0 || requestedChainsLower.some((c) => c !== "solana"));

  if (isSolana && !solanaRequested) {
    throw SyeniteError.invalidInput("Solana address provided but chains does not include 'solana'.");
  }
  if (isEvm && !evmRequested && !solanaRequested) {
    throw SyeniteError.invalidInput("EVM address provided but no supported EVM chains requested.");
  }
  if (isEvm && solanaRequested && !evmRequested) {
    throw SyeniteError.invalidInput("Solana chain requested but address is EVM format.");
  }

  const evmChains: SupportedChain[] = evmRequested
    ? (requestedChainsLower.length > 0
        ? (requestedChainsLower.filter((c): c is SupportedChain =>
            ALL_LENDING_CHAINS.includes(c as SupportedChain),
          ))
        : ALL_LENDING_CHAINS)
    : [];

  const chainsQueried: string[] = [...evmChains];
  if (solanaRequested && isSolana) chainsQueried.push("solana");

  if (chainsQueried.length === 0) {
    throw SyeniteError.invalidInput(`No valid chains. Supported: ${ALL_LENDING_CHAINS.join(", ")}, solana`);
  }

  const balances: ChainBalance[] = [];

  if (evmChains.length > 0 && isEvm) {
    const evmAddr = address as Address;
    const chainResults = await Promise.allSettled(
      evmChains.map((chain) => fetchChainBalances(chain, evmAddr)),
    );
    for (let i = 0; i < evmChains.length; i++) {
      const result = chainResults[i];
      if (result.status === "fulfilled") {
        balances.push(result.value);
      } else {
        log.warn("Balance fetch failed", { chain: evmChains[i], error: (result.reason as Error).message });
        balances.push({
          chain: evmChains[i],
          native: { symbol: NATIVE_SYMBOLS[evmChains[i]], balance: "error", balanceRaw: "0" },
          tokens: [],
        });
      }
    }
  }

  if (solanaRequested && isSolana) {
    try {
      const sol = await fetchSolanaBalances(address);
      balances.push({
        chain: sol.chain,
        native: sol.native,
        tokens: sol.tokens.map((t) => ({
          symbol: t.symbol,
          balance: t.balance,
          balanceRaw: t.balanceRaw,
        })),
      });
    } catch (e) {
      log.warn("Solana balance fetch failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      balances.push({
        chain: "solana",
        native: { symbol: "SOL", balance: "error", balanceRaw: "0" },
        tokens: [],
      });
    }
  }

  const hasNonZero = balances.some(
    (b) => b.native.balanceRaw !== "0" || b.tokens.some((t) => t.balanceRaw !== "0")
  );

  return {
    address,
    chainsQueried,
    balances,
    hasAnyBalance: hasNonZero,
    timestamp: new Date().toISOString(),
    note: "Balances read directly from on-chain RPC. EVM token list covers native gas + major stablecoins; Solana returns native SOL + all non-zero SPL token accounts. — syenite.ai",
  };
}

async function fetchChainBalances(chain: SupportedChain, address: Address): Promise<ChainBalance> {
  const client = getClient(chain);

  const nativeBalance = await client.getBalance({ address });

  const stables = STABLECOINS[chain];
  const tokenResults = await Promise.allSettled(
    stables.map((token) =>
      client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })
    )
  );

  const tokens: ChainBalance["tokens"] = [];
  for (let i = 0; i < stables.length; i++) {
    const result = tokenResults[i];
    if (result.status === "fulfilled") {
      const raw = result.value as bigint;
      if (raw > 0n) {
        tokens.push({
          symbol: stables[i].symbol,
          balance: formatUnits(raw, stables[i].decimals),
          balanceRaw: raw.toString(),
        });
      }
    }
  }

  return {
    chain,
    native: {
      symbol: NATIVE_SYMBOLS[chain],
      balance: formatEther(nativeBalance),
      balanceRaw: nativeBalance.toString(),
    },
    tokens,
  };
}
