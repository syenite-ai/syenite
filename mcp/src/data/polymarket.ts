import { cacheGet, cacheSet } from "./cache.js";
import { log } from "../logging/logger.js";
import { CACHE_TTL } from "./types.js";

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

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
  volume: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  bestBid: number;
  bestAsk: number;
  lastTradePrice: number;
  spread: number;
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
  volume: string;
  liquidity: string;
  active: boolean;
  closed: boolean;
  best_bid: number;
  best_ask: number;
  last_trade_price: number;
  spread: number;
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
  try { outcomes = JSON.parse(m.outcomes); } catch { outcomes = []; }
  try { outcomePrices = JSON.parse(m.outcome_prices); } catch { outcomePrices = []; }

  return {
    id: m.id,
    question: m.question,
    conditionId: m.condition_id,
    slug: m.slug,
    outcomes,
    outcomePrices,
    volume: Number(m.volume) || 0,
    liquidity: Number(m.liquidity) || 0,
    active: m.active,
    closed: m.closed,
    bestBid: m.best_bid ?? 0,
    bestAsk: m.best_ask ?? 0,
    lastTradePrice: m.last_trade_price ?? 0,
    spread: m.spread ?? 0,
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
