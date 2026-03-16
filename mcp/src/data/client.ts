import { createPublicClient, http, type PublicClient } from "viem";
import { mainnet } from "viem/chains";

let client: PublicClient | null = null;

export function getClient(): PublicClient {
  if (client) return client;

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) throw new Error("ALCHEMY_API_KEY is required");

  client = createPublicClient({
    chain: mainnet,
    transport: http(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`),
  });

  return client;
}
