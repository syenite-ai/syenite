import { cacheGet, cacheSet } from "./cache.js";
import { log } from "../logging/logger.js";
import { CACHE_TTL } from "./types.js";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";

export interface PolymarketEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  liquidity: number;
  volume: number;
  markets: PolymarketMarket[];
}

export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  outcomes: string[];
  outcomePrices: string[];
  clobTokenIds?: string[];
  volume: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  bestBid: number;
  bestAsk: number;
  lastTradePrice: number;
  spread: number;
  endDate?: string;
  description?: string;
  volume24hr?: number;
  oneDayPriceChange?: number;
}

interface GammaEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  active: boolean;
  closed: boolean;
  liquidity: number;
  volume: number;
  markets: GammaMarket[];
}

interface GammaMarket {
  id: string;
  question: string;
  condition_id: string;
  slug: string;
  outcomes: string;
  outcome_prices: string;
  clob_token_ids?: string;
  volume: string;
  liquidity: string;
  active: boolean;
  closed: boolean;
  best_bid: number;
  best_ask: number;
  last_trade_price: number;
  spread: number;
  end_date?: string;
  description?: string;
  volume_24hr?: number;
  one_day_price_change?: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

function parseGammaEvent(e: GammaEvent): PolymarketEvent {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    startDate: e.start_date,
    endDate: e.end_date,
    active: e.active,
    closed: e.closed,
    liquidity: e.liquidity,
    volume: e.volume,
    markets: (e.markets ?? []).map(parseGammaMarket),
  };
}

function parseGammaMarket(m: GammaMarket): PolymarketMarket {
  let outcomes: string[] = [];
  let outcomePrices: string[] = [];
  let clobTokenIds: string[] | undefined;
  try { outcomes = JSON.parse(m.outcomes); } catch { outcomes = []; }
  try { outcomePrices = JSON.parse(m.outcome_prices); } catch { outcomePrices = []; }
  if (m.clob_token_ids) {
    try { clobTokenIds = JSON.parse(m.clob_token_ids); } catch { clobTokenIds = undefined; }
  }

  return {
    id: m.id,
    question: m.question,
    conditionId: m.condition_id,
    slug: m.slug,
    outcomes,
    outcomePrices,
    clobTokenIds,
    volume: Number(m.volume) || 0,
    liquidity: Number(m.liquidity) || 0,
    active: m.active,
    closed: m.closed,
    bestBid: m.best_bid ?? 0,
    bestAsk: m.best_ask ?? 0,
    lastTradePrice: m.last_trade_price ?? 0,
    spread: m.spread ?? 0,
    endDate: m.end_date,
    description: m.description,
    volume24hr: m.volume_24hr !== undefined ? Number(m.volume_24hr) : undefined,
    oneDayPriceChange: m.one_day_price_change,
  };
}

export async function getTrendingMarkets(limit: number = 10): Promise<PolymarketEvent[]> {
  const cacheKey = `polymarket:trending:${limit}`;
  const cached = await cacheGet<PolymarketEvent[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<GammaEvent[]>(
      `${GAMMA_API}/events?active=true&closed=false&order=volume&ascending=false&limit=${limit}`
    );
    const events = data.map(parseGammaEvent);
    await cacheSet(cacheKey, events, 120);
    return events;
  } catch (e) {
    log.warn("Polymarket trending fetch failed", { error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

export async function searchMarkets(query: string, limit: number = 10): Promise<PolymarketEvent[]> {
  const cacheKey = `polymarket:search:${query}:${limit}`;
  const cached = await cacheGet<PolymarketEvent[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<GammaEvent[]>(
      `${GAMMA_API}/events?active=true&closed=false&title=${encodeURIComponent(query)}&limit=${limit}`
    );
    const events = data.map(parseGammaEvent);
    await cacheSet(cacheKey, events, 120);
    return events;
  } catch (e) {
    log.warn("Polymarket search failed", { error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

export async function getMarketById(conditionId: string): Promise<PolymarketMarket | null> {
  const cacheKey = `polymarket:market:${conditionId}`;
  const cached = await cacheGet<PolymarketMarket>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<GammaMarket[]>(
      `${GAMMA_API}/markets?condition_id=${conditionId}`
    );
    if (data.length === 0) return null;
    const market = parseGammaMarket(data[0]);
    await cacheSet(cacheKey, market, 60);
    return market;
  } catch (e) {
    log.warn("Polymarket market fetch failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

export interface OrderBookSummary {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  spread: number;
  midPrice: number;
  bidDepthUSD: number;
  askDepthUSD: number;
}

export async function getOrderBook(tokenId: string): Promise<OrderBookSummary | null> {
  const cacheKey = `polymarket:book:${tokenId}`;
  const cached = await cacheGet<OrderBookSummary>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<{
      bids: Array<{ price: string; size: string }>;
      asks: Array<{ price: string; size: string }>;
    }>(`${CLOB_API}/book?token_id=${tokenId}`);

    const bids = (data.bids ?? []).slice(0, 10).map((b) => ({
      price: Number(b.price),
      size: Number(b.size),
    }));
    const asks = (data.asks ?? []).slice(0, 10).map((a) => ({
      price: Number(a.price),
      size: Number(a.size),
    }));

    const bestBid = bids[0]?.price ?? 0;
    const bestAsk = asks[0]?.price ?? 1;

    const summary: OrderBookSummary = {
      bids,
      asks,
      spread: bestAsk - bestBid,
      midPrice: (bestBid + bestAsk) / 2,
      bidDepthUSD: bids.reduce((sum, b) => sum + b.price * b.size, 0),
      askDepthUSD: asks.reduce((sum, a) => sum + a.price * a.size, 0),
    };

    await cacheSet(cacheKey, summary, 30);
    return summary;
  } catch (e) {
    log.warn("Polymarket orderbook fetch failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

// ── Market detail + history (v0.6 Track C) ────────────────────────────

export interface PolymarketPricePoint {
  timestamp: number;
  price: number;
}

export type PriceHistoryInterval = "1h" | "6h" | "1d" | "1w" | "1m" | "max";

export async function getMarketPriceHistory(
  tokenId: string,
  interval: PriceHistoryInterval = "max"
): Promise<PolymarketPricePoint[]> {
  const cacheKey = `polymarket:prices-history:${tokenId}:${interval}`;
  const cached = await cacheGet<PolymarketPricePoint[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<{ history?: Array<{ t: number; p: number }> }>(
      `${CLOB_API}/prices-history?market=${tokenId}&interval=${interval}`
    );
    const history = (data.history ?? []).map((h) => ({
      timestamp: Number(h.t) || 0,
      price: Number(h.p) || 0,
    }));
    await cacheSet(cacheKey, history, 120);
    return history;
  } catch (e) {
    log.warn("Polymarket price history fetch failed", {
      tokenId, interval, error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

export async function getMarketDetail(slugOrId: string): Promise<PolymarketMarket | null> {
  const cacheKey = `polymarket:detail:${slugOrId}`;
  const cached = await cacheGet<PolymarketMarket>(cacheKey);
  if (cached) return cached;

  const candidates = [
    `${GAMMA_API}/markets?slug=${encodeURIComponent(slugOrId)}`,
    `${GAMMA_API}/markets?condition_id=${encodeURIComponent(slugOrId)}`,
    `${GAMMA_API}/markets?id=${encodeURIComponent(slugOrId)}`,
  ];

  for (const url of candidates) {
    try {
      const data = await fetchJson<GammaMarket[]>(url);
      if (data && data.length > 0) {
        const market = parseGammaMarket(data[0]);
        await cacheSet(cacheKey, market, 60);
        return market;
      }
    } catch (e) {
      log.warn("Polymarket market detail attempt failed", {
        url, error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return null;
}

// ── Positions (v0.6 Track C) ───────────────────────────────────────────

export interface PolymarketPosition {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  outcome: string;
  outcomeIndex: number;
  title: string;
  slug: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  currentPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  percentPnl: number;
  endDate?: string;
  icon?: string;
  redeemable?: boolean;
}

interface RawPosition {
  proxyWallet?: string;
  asset?: string;
  conditionId?: string;
  outcome?: string;
  outcomeIndex?: number;
  title?: string;
  slug?: string;
  size?: number;
  avgPrice?: number;
  initialValue?: number;
  currentValue?: number;
  curPrice?: number;
  realizedPnl?: number;
  cashPnl?: number;
  percentPnl?: number;
  endDate?: string;
  icon?: string;
  redeemable?: boolean;
}

export async function getUserPositions(address: string): Promise<PolymarketPosition[]> {
  try {
    const data = await fetchJson<RawPosition[]>(
      `${DATA_API}/positions?user=${encodeURIComponent(address)}&sizeThreshold=0`
    );
    return (data ?? []).map((p) => ({
      proxyWallet: p.proxyWallet ?? "",
      asset: p.asset ?? "",
      conditionId: p.conditionId ?? "",
      outcome: p.outcome ?? "",
      outcomeIndex: p.outcomeIndex ?? 0,
      title: p.title ?? "",
      slug: p.slug ?? "",
      size: Number(p.size) || 0,
      avgPrice: Number(p.avgPrice) || 0,
      initialValue: Number(p.initialValue) || 0,
      currentValue: Number(p.currentValue) || 0,
      currentPrice: Number(p.curPrice) || 0,
      realizedPnl: Number(p.realizedPnl) || 0,
      unrealizedPnl: Number(p.cashPnl) || 0,
      percentPnl: Number(p.percentPnl) || 0,
      endDate: p.endDate,
      icon: p.icon,
      redeemable: p.redeemable,
    }));
  } catch (e) {
    log.warn("Polymarket positions fetch failed", {
      address, error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

// ── Midpoint price (v0.6 Track C) ──────────────────────────────────────

export async function getMidpointPrice(tokenId: string): Promise<number | null> {
  const cacheKey = `polymarket:midpoint:${tokenId}`;
  const cached = await cacheGet<number>(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  try {
    const data = await fetchJson<{ mid?: string | number }>(
      `${CLOB_API}/midpoint?token_id=${tokenId}`
    );
    const mid = Number(data.mid);
    if (!Number.isFinite(mid)) return null;
    await cacheSet(cacheKey, mid, 20);
    return mid;
  } catch (e) {
    log.warn("Polymarket midpoint fetch failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
