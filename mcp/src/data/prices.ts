import { type Address } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { CHAINLINK_FEEDS, CACHE_TTL } from "./types.js";

const chainlinkAbi = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

interface PriceResult {
  price: number;
  updatedAt: number;
}

export async function getPrice(pair: string): Promise<PriceResult> {
  const cacheKey = `price:${pair}`;
  const cached = cacheGet<PriceResult>(cacheKey);
  if (cached) return cached;

  const feed = CHAINLINK_FEEDS[pair];
  if (!feed) throw new Error(`No Chainlink feed for ${pair}`);

  const client = getClient();
  const [roundData, decimals] = await Promise.all([
    client.readContract({
      address: feed,
      abi: chainlinkAbi,
      functionName: "latestRoundData",
    }),
    client.readContract({
      address: feed,
      abi: chainlinkAbi,
      functionName: "decimals",
    }),
  ]);

  const result: PriceResult = {
    price: Number(roundData[1]) / 10 ** decimals,
    updatedAt: Number(roundData[3]),
  };

  cacheSet(cacheKey, result, CACHE_TTL.prices);
  return result;
}

export async function getBtcPrice(): Promise<number> {
  const { price } = await getPrice("BTC/USD");
  return price;
}

export async function getEthPrice(): Promise<number> {
  const { price } = await getPrice("ETH/USD");
  return price;
}

export async function getStablePrice(
  symbol: string
): Promise<number> {
  const pair = `${symbol}/USD`;
  if (!CHAINLINK_FEEDS[pair]) return 1.0; // assume $1 for unknown stables
  const { price } = await getPrice(pair);
  return price;
}
