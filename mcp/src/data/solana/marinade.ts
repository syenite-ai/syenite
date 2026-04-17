import { cacheGet, cacheSet } from "../cache.js";
import { fetchJson } from "./http.js";
import { SOLANA_CACHE_TTL } from "./types.js";

const MARINADE_URL = "https://api.marinade.finance/msol/apy/500d";
const MARINADE_TVL_URL = "https://api.marinade.finance/tlv";
const CACHE_KEY = "solana:marinade:rate";

export interface MarinadeRate {
  protocol: "marinade";
  product: "mSOL";
  asset: "SOL";
  apy: number;
  tvlUSD: number;
  tvlSOL: number;
}

interface MarinadeApyApi {
  value?: number;
  apy?: number;
}

interface MarinadeTvlApi {
  total_staked_sol?: number;
  tlv_sol?: number;
  tlv_usd?: number;
  sol_price_usd?: number;
}

export async function getMarinadeRate(): Promise<MarinadeRate | null> {
  const cached = await cacheGet<MarinadeRate>(CACHE_KEY);
  if (cached) return cached;

  const [apyData, tvlData] = await Promise.all([
    fetchJson<MarinadeApyApi>(MARINADE_URL, { label: "marinade:apy" }),
    fetchJson<MarinadeTvlApi>(MARINADE_TVL_URL, { label: "marinade:tvl" }),
  ]);

  if (!apyData && !tvlData) return null;

  const rawApy = apyData?.value ?? apyData?.apy ?? 0;
  const apy = rawApy < 1 ? rawApy * 100 : rawApy;
  const tvlSOL = tvlData?.total_staked_sol ?? tvlData?.tlv_sol ?? 0;
  const tvlUSD =
    tvlData?.tlv_usd ?? tvlSOL * (tvlData?.sol_price_usd ?? 0);

  const result: MarinadeRate = {
    protocol: "marinade",
    product: "mSOL",
    asset: "SOL",
    apy,
    tvlSOL,
    tvlUSD,
  };

  await cacheSet(CACHE_KEY, result, SOLANA_CACHE_TTL.staking);
  return result;
}
