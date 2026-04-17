import { cacheGet, cacheSet } from "../cache.js";
import { fetchJson } from "./http.js";
import { SOLANA_CACHE_TTL, type SolanaMarketRate } from "./types.js";

const MARGINFI_BASE = "https://app.marginfi.com/api/birdeyeBanks";
const CACHE_KEY = "solana:marginfi:markets";

interface MarginFiBankApi {
  address?: string;
  tokenSymbol?: string;
  symbol?: string;
  mint?: string;
  lendingRate?: number | string;
  borrowingRate?: number | string;
  lendingRateApy?: number | string;
  borrowingRateApy?: number | string;
  utilizationRate?: number | string;
  totalDeposits?: number | string;
  totalBorrows?: number | string;
  tokenPrice?: number | string;
  price?: number | string;
  availableLiquidity?: number | string;
  tvl?: number | string;
}

function numOrZero(v: number | string | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getMarginFiMarkets(): Promise<SolanaMarketRate[]> {
  const cached = await cacheGet<SolanaMarketRate[]>(CACHE_KEY);
  if (cached) return cached;

  const data = await fetchJson<MarginFiBankApi[] | { banks?: MarginFiBankApi[] }>(
    MARGINFI_BASE,
    { label: "marginfi:banks" },
  );

  const banks: MarginFiBankApi[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.banks)
      ? data.banks
      : [];

  if (banks.length === 0) return [];

  const markets: SolanaMarketRate[] = [];
  for (const b of banks) {
    const symbol = b.tokenSymbol ?? b.symbol ?? "";
    const price = numOrZero(b.tokenPrice ?? b.price);
    const deposits = numOrZero(b.totalDeposits);
    const borrows = numOrZero(b.totalBorrows);
    const util = numOrZero(b.utilizationRate) * (b.utilizationRate && Number(b.utilizationRate) > 1 ? 1 : 100);
    const supplyAPY = numOrZero(b.lendingRateApy ?? b.lendingRate) * 100;
    const borrowAPY = numOrZero(b.borrowingRateApy ?? b.borrowingRate) * 100;
    const available = numOrZero(b.availableLiquidity) || Math.max(deposits - borrows, 0);
    markets.push({
      protocol: "marginfi",
      chain: "solana",
      reserve: b.address ?? b.mint ?? "",
      market: `MarginFi ${symbol}`.trim(),
      asset: symbol,
      supplyAPY,
      borrowAPY,
      utilization: util,
      tvlUSD: deposits * price,
      liquidityUSD: available * price,
    });
  }

  if (markets.length > 0) {
    await cacheSet(CACHE_KEY, markets, SOLANA_CACHE_TTL.markets);
  }
  return markets;
}
