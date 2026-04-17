import { cacheGet, cacheSet } from "../cache.js";
import { fetchJson } from "./http.js";
import { SOLANA_CACHE_TTL } from "./types.js";

const SANCTUM_APY_URL = "https://extra-api.sanctum.so/v1/apy/latest";
const SANCTUM_TVL_URL = "https://extra-api.sanctum.so/v1/tvl/current";
const CACHE_KEY = "solana:sanctum:lsts";

export interface SanctumLST {
  protocol: "sanctum";
  product: string;
  asset: "SOL";
  mint: string;
  apy: number;
  tvlUSD: number;
  tvlSOL: number;
}

interface SanctumApyApi {
  apys?: Record<string, number>;
}

interface SanctumTvlApi {
  tvls?: Record<string, number>;
  solPrice?: number;
}

const SANCTUM_LSTS: Array<{ symbol: string; mint: string }> = [
  { symbol: "INF", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm" },
  { symbol: "jupSOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v" },
  { symbol: "bSOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1" },
  { symbol: "hSOL", mint: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A" },
  { symbol: "compassSOL", mint: "Comp4ssDzXcLeu2MnLuGNNFC4cmLPMng8qWHPvzAMU1h" },
  { symbol: "picoSOL", mint: "picobAEvs6w7QEknPce34wAE4gknZA9v5tTonnmHYdX" },
  { symbol: "dSOL", mint: "Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ" },
];

function buildQuery(mints: string[]): string {
  const qs = new URLSearchParams();
  for (const m of mints) qs.append("lst", m);
  return qs.toString();
}

export async function getSanctumLSTs(): Promise<SanctumLST[]> {
  const cached = await cacheGet<SanctumLST[]>(CACHE_KEY);
  if (cached) return cached;

  const mints = SANCTUM_LSTS.map((l) => l.mint);
  const qs = buildQuery(mints);
  const [apyData, tvlData] = await Promise.all([
    fetchJson<SanctumApyApi>(`${SANCTUM_APY_URL}?${qs}`, { label: "sanctum:apy" }),
    fetchJson<SanctumTvlApi>(`${SANCTUM_TVL_URL}?${qs}`, { label: "sanctum:tvl" }),
  ]);

  if (!apyData && !tvlData) return [];

  const apys = apyData?.apys ?? {};
  const tvls = tvlData?.tvls ?? {};
  const solPrice = tvlData?.solPrice ?? 0;

  const results: SanctumLST[] = [];
  for (const lst of SANCTUM_LSTS) {
    const rawApy = apys[lst.mint] ?? 0;
    const apy = rawApy < 1 ? rawApy * 100 : rawApy;
    const tvlSOL = tvls[lst.mint] ?? 0;
    results.push({
      protocol: "sanctum",
      product: lst.symbol,
      asset: "SOL",
      mint: lst.mint,
      apy,
      tvlSOL,
      tvlUSD: tvlSOL * solPrice,
    });
  }

  const hasData = results.some((r) => r.apy > 0 || r.tvlSOL > 0);
  if (hasData) await cacheSet(CACHE_KEY, results, SOLANA_CACHE_TTL.lst);
  return hasData ? results : [];
}
