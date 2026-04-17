import { cacheGet, cacheSet } from "../cache.js";
import { fetchJson } from "./http.js";
import { SOLANA_CACHE_TTL } from "./types.js";

const DRIFT_INSURANCE_URL = "https://mainnet-beta.api.drift.trade/insurance/apy";
const DRIFT_SPOT_MARKETS_URL = "https://mainnet-beta.api.drift.trade/spotMarkets";
const CACHE_KEY = "solana:drift:yields";

export interface DriftYield {
  protocol: "drift";
  product: string;
  asset: string;
  apy: number;
  category: "basis-capture" | "lending-supply";
  tvlUSD: number;
}

interface DriftInsuranceApi {
  data?: Record<string, { apy?: number; apyApr?: number; tvl?: number }>;
}

interface DriftSpotMarketApi {
  marketIndex?: number;
  symbol?: string;
  depositApr?: number;
  borrowApr?: number;
  depositBalance?: number;
  price?: number;
}

export async function getDriftYields(): Promise<DriftYield[]> {
  const cached = await cacheGet<DriftYield[]>(CACHE_KEY);
  if (cached) return cached;

  const [insuranceData, spotData] = await Promise.all([
    fetchJson<DriftInsuranceApi>(DRIFT_INSURANCE_URL, { label: "drift:insurance" }),
    fetchJson<{ data?: DriftSpotMarketApi[] } | DriftSpotMarketApi[]>(
      DRIFT_SPOT_MARKETS_URL,
      { label: "drift:spot" },
    ),
  ]);

  const results: DriftYield[] = [];

  if (insuranceData?.data) {
    for (const [asset, v] of Object.entries(insuranceData.data)) {
      const rawApy = v.apyApr ?? v.apy ?? 0;
      const apy = rawApy < 1 ? rawApy * 100 : rawApy;
      if (apy <= 0) continue;
      results.push({
        protocol: "drift",
        product: `Drift Insurance Fund (${asset})`,
        asset,
        apy,
        category: "basis-capture",
        tvlUSD: v.tvl ?? 0,
      });
    }
  }

  const spotMarkets = Array.isArray(spotData)
    ? spotData
    : Array.isArray(spotData?.data)
      ? spotData.data
      : [];
  for (const m of spotMarkets) {
    if (!m.symbol) continue;
    const rawApy = m.depositApr ?? 0;
    const apy = rawApy < 1 ? rawApy * 100 : rawApy;
    if (apy <= 0) continue;
    results.push({
      protocol: "drift",
      product: `Drift Spot Lending (${m.symbol})`,
      asset: m.symbol,
      apy,
      category: "lending-supply",
      tvlUSD: (m.depositBalance ?? 0) * (m.price ?? 0),
    });
  }

  if (results.length > 0) {
    await cacheSet(CACHE_KEY, results, SOLANA_CACHE_TTL.drift);
  }
  return results;
}
