import { cacheGet, cacheSet } from "../cache.js";
import { fetchJson } from "./http.js";
import { SOLANA_CACHE_TTL } from "./types.js";

const JITO_URL = "https://kobe.mainnet.jito.network/api/v1/stake_pool_stats";
const CACHE_KEY = "solana:jito:staking";

export interface JitoStakingRate {
  protocol: "jito";
  product: "jitoSOL";
  asset: "SOL";
  apy: number;
  tvlUSD: number;
  tvlSOL: number;
}

interface JitoApi {
  apy?: Array<{ data?: number }> | number;
  tvl?: Array<{ data?: number }> | number;
  solPrice?: number;
}

function pickLatest(v: Array<{ data?: number }> | number | undefined): number {
  if (typeof v === "number") return v;
  if (!Array.isArray(v) || v.length === 0) return 0;
  const last = v[v.length - 1];
  return typeof last?.data === "number" ? last.data : 0;
}

export async function getJitoStakingRate(): Promise<JitoStakingRate | null> {
  const cached = await cacheGet<JitoStakingRate>(CACHE_KEY);
  if (cached) return cached;

  const data = await fetchJson<JitoApi>(JITO_URL, { label: "jito:stake_pool_stats" });
  if (!data) return null;

  const apy = pickLatest(data.apy) * (pickLatest(data.apy) < 1 ? 100 : 1);
  const tvlSOL = pickLatest(data.tvl);
  const solPrice = data.solPrice ?? 0;

  const result: JitoStakingRate = {
    protocol: "jito",
    product: "jitoSOL",
    asset: "SOL",
    apy,
    tvlSOL,
    tvlUSD: tvlSOL * solPrice,
  };

  await cacheSet(CACHE_KEY, result, SOLANA_CACHE_TTL.staking);
  return result;
}
