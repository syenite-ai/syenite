import { createPublicClient, http, type PublicClient, type Chain } from "viem";
import { mainnet, arbitrum, base, bsc } from "viem/chains";

export type SupportedChain = "ethereum" | "arbitrum" | "base" | "bsc";

const CHAIN_DEFS: Record<SupportedChain, Chain> = {
  ethereum: mainnet,
  arbitrum,
  base,
  bsc,
};

const ALCHEMY_SLUG: Partial<Record<SupportedChain, string>> = {
  ethereum: "eth-mainnet",
  arbitrum: "arb-mainnet",
  base: "base-mainnet",
};

const PUBLIC_RPC: Partial<Record<SupportedChain, string>> = {
  bsc: "https://bsc-dataseed1.binance.org",
};

const clients = new Map<SupportedChain, PublicClient>();

function buildRpcUrl(chain: SupportedChain): string {
  const apiKey = process.env.ALCHEMY_API_KEY;
  const slug = ALCHEMY_SLUG[chain];
  if (apiKey && slug) return `https://${slug}.g.alchemy.com/v2/${apiKey}`;
  const pub = PUBLIC_RPC[chain];
  if (pub) return pub;
  if (!apiKey) throw new Error("ALCHEMY_API_KEY is required");
  throw new Error(`No RPC configured for chain: ${chain}`);
}

export function getClient(chain: SupportedChain = "ethereum"): PublicClient {
  const existing = clients.get(chain);
  if (existing) return existing;

  const client = createPublicClient({
    chain: CHAIN_DEFS[chain],
    transport: http(buildRpcUrl(chain), { timeout: 15_000 }),
  });

  clients.set(chain, client);
  return client;
}

export const ALL_LENDING_CHAINS: SupportedChain[] = ["ethereum", "arbitrum", "base", "bsc"];
