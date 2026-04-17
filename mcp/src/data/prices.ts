import { type Address } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { CHAINLINK_FEEDS, CACHE_TTL, TOKEN_PRICE_FEED } from "./types.js";
import { SyeniteError } from "../errors.js";

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
  const cached = await cacheGet<PriceResult>(cacheKey);
  if (cached) return cached;

  const feed = CHAINLINK_FEEDS[pair];
  if (!feed) throw SyeniteError.notFound(`No Chainlink feed for ${pair}`);

  const client = getClient();
  let roundData: readonly [bigint, bigint, bigint, bigint, bigint];
  let decimals: number;
  try {
    [roundData, decimals] = await Promise.all([
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw SyeniteError.upstream(`Chainlink price feed ${pair} RPC failed: ${msg}`);
  }

  const answer = Number(roundData[1]);
  if (answer <= 0) {
    throw SyeniteError.upstream(`Chainlink feed ${pair} returned non-positive price: ${answer}`);
  }

  const updatedAt = Number(roundData[3]);
  const now = Math.floor(Date.now() / 1000);
  const ageSeconds = now - updatedAt;
  const MAX_STALENESS_S = 3600;
  if (ageSeconds > MAX_STALENESS_S) {
    console.warn(`[syenite] Chainlink feed ${pair} stale: last updated ${ageSeconds}s ago`);
  }

  const result: PriceResult = {
    price: answer / 10 ** decimals,
    updatedAt,
  };

  await cacheSet(cacheKey, result, CACHE_TTL.prices);
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
  if (!CHAINLINK_FEEDS[pair]) return 1.0;
  const { price } = await getPrice(pair);
  return price;
}

/** Get USD price for any known token via its mapped Chainlink feed */
export async function getTokenPrice(symbol: string): Promise<number> {
  const feedPair = TOKEN_PRICE_FEED[symbol];
  if (!feedPair) throw SyeniteError.invalidInput(`No price feed for "${symbol}". Supported: ${Object.keys(TOKEN_PRICE_FEED).join(", ")}`);
  const { price } = await getPrice(feedPair);
  return price;
}
