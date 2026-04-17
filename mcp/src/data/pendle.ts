import { getAddress, type Address } from "viem";
import { cacheGet, cacheSet } from "./cache.js";
import { log } from "../logging/logger.js";
import {
  PENDLE_API_BASE,
  PENDLE_CHAINS,
  CACHE_TTL,
  type PendleMarket,
} from "./types.js";

// ── Shapes from the Pendle v1 core REST API ─────────────────────────
//
// The response shape for /core/v1/{chainId}/markets/active matches:
//   { markets: [{ name, expiry, address, pt, yt, underlyingAsset,
//                 liquidity: { usd }, details: { pt, yt, underlyingApy,
//                 impliedApy, aggregatedApy, maxBoostedApy, tvl } }] }
// We defensively tolerate missing fields — the endpoint shape has drifted
// historically — and return [] on any parse failure rather than throwing.

interface PendleAsset {
  address?: string;
  symbol?: string;
}

interface PendleDetails {
  pt?: number;
  yt?: number;
  impliedApy?: number;
  underlyingApy?: number;
  aggregatedApy?: number;
  maxBoostedApy?: number;
  tvl?: number;
}

interface PendleApiMarket {
  name?: string;
  expiry?: string;
  address?: string;
  pt?: PendleAsset | string;
  yt?: PendleAsset | string;
  underlyingAsset?: PendleAsset;
  accountingAsset?: PendleAsset;
  liquidity?: { usd?: number };
  details?: PendleDetails;
}

interface PendleMarketsResponse {
  markets?: PendleApiMarket[];
  results?: PendleApiMarket[];
  total?: number;
}

function tryChecksum(addr: string | undefined): Address | undefined {
  if (!addr) return undefined;
  try {
    return getAddress(addr);
  } catch {
    return undefined;
  }
}

function extractAssetAddress(x: PendleAsset | string | undefined): Address | undefined {
  if (!x) return undefined;
  if (typeof x === "string") {
    // Pendle often returns "chainId-address" composite IDs
    const parts = x.split("-");
    return tryChecksum(parts[parts.length - 1]);
  }
  return tryChecksum(x.address);
}

function mapApiMarket(chain: string, m: PendleApiMarket): PendleMarket | null {
  const address = tryChecksum(m.address);
  if (!address) return null;
  const expiryIso = m.expiry ?? "";
  const maturityTs = expiryIso ? Date.parse(expiryIso) / 1000 : 0;
  if (!Number.isFinite(maturityTs) || maturityTs <= 0) return null;

  const underlying = m.underlyingAsset?.symbol ?? m.accountingAsset?.symbol ?? "unknown";
  const details = m.details ?? {};
  // PT APY: prefer details.pt, fall back to implied if missing.
  const ptFixed = (details.pt ?? details.impliedApy ?? 0) * 100;
  const ytImplied = (details.yt ?? details.maxBoostedApy ?? 0) * 100;
  const underlyingAPY = (details.underlyingApy ?? details.aggregatedApy ?? 0) * 100;
  const tvlUSD = details.tvl ?? m.liquidity?.usd ?? 0;
  const liquidityUSD = m.liquidity?.usd ?? 0;

  return {
    chain,
    address,
    name: m.name ?? `PT-${underlying}`,
    underlying,
    maturity: expiryIso,
    maturityTimestamp: Math.floor(maturityTs),
    ptFixedAPY: ptFixed,
    ytImpliedAPY: ytImplied,
    underlyingAPY,
    tvlUSD,
    liquidityUSD,
    ptTokenAddress: extractAssetAddress(m.pt),
    ytTokenAddress: extractAssetAddress(m.yt),
  };
}

async function fetchChainMarkets(chain: string): Promise<PendleMarket[]> {
  const chainId = PENDLE_CHAINS[chain];
  if (!chainId) return [];
  const url = `${PENDLE_API_BASE}/${chainId}/markets/active`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      log.warn("pendle api non-ok", { chain, status: res.status });
      return [];
    }
    const json = (await res.json()) as PendleMarketsResponse;
    const raw = json.markets ?? json.results ?? [];
    const now = Math.floor(Date.now() / 1000);
    return raw
      .map((m) => mapApiMarket(chain, m))
      .filter((m): m is PendleMarket => m !== null && m.maturityTimestamp > now);
  } catch (e) {
    log.warn("pendle fetch failed", { chain, error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

export interface PendleOptions {
  chain?: string;
  includeYT?: boolean;
}

export async function getPendleMarkets(opts: PendleOptions = {}): Promise<PendleMarket[]> {
  const targetChains = opts.chain ? [opts.chain] : Object.keys(PENDLE_CHAINS);
  const cacheKey = `pendle:markets:${targetChains.sort().join(",")}`;
  const cached = await cacheGet<PendleMarket[]>(cacheKey);
  if (cached) return cached;

  const results = await Promise.allSettled(targetChains.map((c) => fetchChainMarkets(c)));
  const markets = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (markets.length > 0) await cacheSet(cacheKey, markets, CACHE_TTL.yield);
  return markets;
}

/** Format a maturity ISO string as "matures YYYY-MM-DD". */
export function formatMaturityLockup(iso: string): string {
  const date = iso.slice(0, 10);
  return `matures ${date}`;
}
