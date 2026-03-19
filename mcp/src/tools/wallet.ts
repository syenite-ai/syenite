import { formatEther, formatUnits, erc20Abi, type Address } from "viem";
import { getClient, ALL_LENDING_CHAINS, type SupportedChain } from "../data/client.js";
import { SyeniteError } from "../errors.js";
import { log } from "../logging/logger.js";

export const walletBalancesDescription = `Check native and token balances for any EVM address across supported chains (Ethereum, Arbitrum, Base, BNB Chain).
Returns native gas token balance, common stablecoin balances, and USD-equivalent totals per chain.
Use this to verify an address has sufficient funds before executing swaps, bridges, or on-chain operations.`;

const NATIVE_SYMBOLS: Record<SupportedChain, string> = {
  ethereum: "ETH",
  arbitrum: "ETH",
  base: "ETH",
  bsc: "BNB",
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
  const address = params.address as Address;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw SyeniteError.invalidInput("Invalid EVM address");
  }

  const requestedChains = params.chains?.length
    ? params.chains.filter((c): c is SupportedChain => ALL_LENDING_CHAINS.includes(c as SupportedChain))
    : ALL_LENDING_CHAINS;

  if (requestedChains.length === 0) {
    throw SyeniteError.invalidInput(`No valid chains. Supported: ${ALL_LENDING_CHAINS.join(", ")}`);
  }

  const chainResults = await Promise.allSettled(
    requestedChains.map((chain) => fetchChainBalances(chain, address))
  );

  const balances: ChainBalance[] = [];
  for (let i = 0; i < requestedChains.length; i++) {
    const result = chainResults[i];
    if (result.status === "fulfilled") {
      balances.push(result.value);
    } else {
      log.warn("Balance fetch failed", { chain: requestedChains[i], error: (result.reason as Error).message });
      balances.push({
        chain: requestedChains[i],
        native: { symbol: NATIVE_SYMBOLS[requestedChains[i]], balance: "error", balanceRaw: "0" },
        tokens: [],
      });
    }
  }

  const hasNonZero = balances.some(
    (b) => b.native.balanceRaw !== "0" || b.tokens.some((t) => t.balanceRaw !== "0")
  );

  return {
    address,
    chainsQueried: requestedChains,
    balances,
    hasAnyBalance: hasNonZero,
    timestamp: new Date().toISOString(),
    note: "Balances read directly from on-chain RPC. Token list covers native gas + major stablecoins. — syenite.ai",
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
