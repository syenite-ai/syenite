import { cacheGet, cacheSet } from "../cache.js";
import { fetchJson } from "./http.js";
import { SOLANA_CACHE_TTL, type SolanaMarketRate } from "./types.js";

const KAMINO_BASE = "https://api.kamino.finance";
const CACHE_KEY = "solana:kamino:markets";

interface KaminoReserveApi {
  mintAddress?: string;
  symbol?: string;
  liquidity?: {
    totalSupply?: string | number;
    totalBorrow?: string | number;
    available?: string | number;
    supplyAPY?: string | number;
    borrowAPY?: string | number;
    utilizationRatio?: string | number;
    tokenPrice?: string | number;
  };
  reserve?: string;
}

interface KaminoMarketApi {
  lendingMarket?: string;
  name?: string;
  reserves?: KaminoReserveApi[];
}

function numOrZero(v: string | number | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getKaminoMarkets(): Promise<SolanaMarketRate[]> {
  const cached = await cacheGet<SolanaMarketRate[]>(CACHE_KEY);
  if (cached) return cached;

  const data = await fetchJson<KaminoMarketApi[]>(
    `${KAMINO_BASE}/v2/kamino-market`,
    { label: "kamino:markets" },
  );

  if (!data || !Array.isArray(data)) return [];

  const markets: SolanaMarketRate[] = [];
  for (const market of data) {
    const marketName = market.name ?? market.lendingMarket ?? "Kamino";
    const reserves = market.reserves ?? [];
    for (const r of reserves) {
      const liq = r.liquidity ?? {};
      const supplyAPY = numOrZero(liq.supplyAPY) * 100;
      const borrowAPY = numOrZero(liq.borrowAPY) * 100;
      const util = numOrZero(liq.utilizationRatio) * 100;
      const price = numOrZero(liq.tokenPrice);
      const totalSupply = numOrZero(liq.totalSupply);
      const available = numOrZero(liq.available);
      markets.push({
        protocol: "kamino",
        chain: "solana",
        reserve: r.reserve ?? r.mintAddress ?? "",
        market: `Kamino ${marketName} ${r.symbol ?? ""}`.trim(),
        asset: r.symbol ?? "",
        supplyAPY,
        borrowAPY,
        utilization: util,
        tvlUSD: totalSupply * price,
        liquidityUSD: available * price,
      });
    }
  }

  if (markets.length > 0) {
    await cacheSet(CACHE_KEY, markets, SOLANA_CACHE_TTL.markets);
  }
  return markets;
}
