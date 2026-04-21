import { cacheGet, cacheSet } from "./cache.js";
import { log } from "../logging/logger.js";

const KALSHI_API = "https://trading-api.kalshi.com/trade-api/v2";

// ── Public interfaces ──────────────────────────────────────────────────

export interface KalshiMarket {
  ticker: string;
  eventTicker: string;
  title: string;
  subtitle: string;
  status: "open" | "closed" | "settled" | "finalized";
  // Prices in cents (0–99). YES + NO ≈ 100¢.
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
  lastPrice: number;
  previousPrice: number;
  volume: number;      // contracts
  volume24h: number;   // contracts
  liquidityCents: number;
  openInterest: number;
  result?: "yes" | "no";
  closeTime: string;
  expirationTime: string;
  rulesPrimary: string;
  rulesSecondary: string;
  category: string;
}

export interface KalshiEvent {
  eventTicker: string;
  seriesTicker: string;
  title: string;
  subtitle: string;
  category: string;
  mutuallyExclusive: boolean;
  markets: KalshiMarket[];
}

export interface KalshiOrderBook {
  // [price_cents, quantity_contracts][] — sorted best-price-first
  yes: Array<{ price: number; size: number }>;
  no: Array<{ price: number; size: number }>;
  yesMid: number;  // cents
  spread: number;  // cents
  spreadBps: number;
  impliedProbabilityPct: number;  // ≈ yesAsk (the cost to buy YES)
  yesBidDepth: number;  // contracts
  yesAskDepth: number;
}

// ── Raw API shapes ──────────────────────────────────────────────────────

interface RawMarket {
  ticker?: string;
  event_ticker?: string;
  title?: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  previous_yes_bid?: number;
  previous_yes_ask?: number;
  previous_price?: number;
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
  open_interest?: number;
  result?: string;
  close_time?: string;
  expiration_time?: string;
  rules_primary?: string;
  rules_secondary?: string;
  category?: string;
}

interface RawEvent {
  event_ticker?: string;
  series_ticker?: string;
  title?: string;
  sub_title?: string;
  category?: string;
  mutually_exclusive?: boolean;
  markets?: RawMarket[];
}

// ── Parsing ────────────────────────────────────────────────────────────

function parseMarket(m: RawMarket): KalshiMarket {
  const status = (m.status ?? "open") as KalshiMarket["status"];
  const result = m.result === "yes" || m.result === "no" ? m.result : undefined;
  return {
    ticker: m.ticker ?? "",
    eventTicker: m.event_ticker ?? "",
    title: m.title ?? "",
    subtitle: m.subtitle ?? m.yes_sub_title ?? "",
    status,
    yesBid: m.yes_bid ?? 0,
    yesAsk: m.yes_ask ?? 0,
    noBid: m.no_bid ?? 0,
    noAsk: m.no_ask ?? 0,
    lastPrice: m.last_price ?? 0,
    previousPrice: m.previous_price ?? 0,
    volume: m.volume ?? 0,
    volume24h: m.volume_24h ?? 0,
    liquidityCents: m.liquidity ?? 0,
    openInterest: m.open_interest ?? 0,
    result,
    closeTime: m.close_time ?? "",
    expirationTime: m.expiration_time ?? "",
    rulesPrimary: m.rules_primary ?? "",
    rulesSecondary: m.rules_secondary ?? "",
    category: m.category ?? "",
  };
}

function parseEvent(e: RawEvent): KalshiEvent {
  return {
    eventTicker: e.event_ticker ?? "",
    seriesTicker: e.series_ticker ?? "",
    title: e.title ?? "",
    subtitle: e.sub_title ?? "",
    category: e.category ?? "",
    mutuallyExclusive: e.mutually_exclusive ?? false,
    markets: (e.markets ?? []).map(parseMarket),
  };
}

// ── Fetch helpers ───────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ── Public functions ────────────────────────────────────────────────────

export async function getTrendingEvents(limit: number = 25): Promise<KalshiEvent[]> {
  const cacheKey = `kalshi:trending:${limit}`;
  const cached = await cacheGet<KalshiEvent[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<{ events?: RawEvent[]; cursor?: string }>(
      `${KALSHI_API}/events?limit=${limit}&status=open&with_nested_markets=true`
    );
    const events = (data.events ?? []).map(parseEvent);
    await cacheSet(cacheKey, events, 120);
    return events;
  } catch (e) {
    log.warn("Kalshi trending fetch failed", { error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

export async function searchEvents(query: string, limit: number = 25): Promise<KalshiEvent[]> {
  // Kalshi has no free-text search; fetch trending events and filter by keyword
  const cacheKey = `kalshi:search:${query}:${limit}`;
  const cached = await cacheGet<KalshiEvent[]>(cacheKey);
  if (cached) return cached;

  try {
    const q = query.toLowerCase();
    // Fetch more events to increase recall before filtering
    const data = await fetchJson<{ events?: RawEvent[]; cursor?: string }>(
      `${KALSHI_API}/events?limit=200&status=open&with_nested_markets=true`
    );
    const all = (data.events ?? []).map(parseEvent);
    const filtered = all
      .filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.subtitle.toLowerCase().includes(q) ||
          e.eventTicker.toLowerCase().includes(q) ||
          e.seriesTicker.toLowerCase().includes(q) ||
          e.markets.some(
            (m) => m.title.toLowerCase().includes(q) || m.subtitle.toLowerCase().includes(q)
          )
      )
      .slice(0, limit);

    await cacheSet(cacheKey, filtered, 120);
    return filtered;
  } catch (e) {
    log.warn("Kalshi search failed", { error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

export async function getEventDetail(eventTicker: string): Promise<KalshiEvent | null> {
  const cacheKey = `kalshi:event:${eventTicker}`;
  const cached = await cacheGet<KalshiEvent>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<{ event?: RawEvent }>(
      `${KALSHI_API}/events/${encodeURIComponent(eventTicker)}?with_nested_markets=true`
    );
    if (!data.event) return null;
    const event = parseEvent(data.event);
    await cacheSet(cacheKey, event, 60);
    return event;
  } catch (e) {
    log.warn("Kalshi event detail fetch failed", {
      eventTicker, error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function getMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
  const cacheKey = `kalshi:market:${ticker}`;
  const cached = await cacheGet<KalshiMarket>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<{ market?: RawMarket }>(
      `${KALSHI_API}/markets/${encodeURIComponent(ticker)}`
    );
    if (!data.market) return null;
    const market = parseMarket(data.market);
    await cacheSet(cacheKey, market, 60);
    return market;
  } catch (e) {
    log.warn("Kalshi market fetch failed", {
      ticker, error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function getOrderBook(ticker: string, depth: number = 10): Promise<KalshiOrderBook | null> {
  const cacheKey = `kalshi:book:${ticker}:${depth}`;
  const cached = await cacheGet<KalshiOrderBook>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<{
      orderbook?: { yes?: number[][]; no?: number[][] };
    }>(`${KALSHI_API}/markets/${encodeURIComponent(ticker)}/orderbook?depth=${depth}`);

    const raw = data.orderbook ?? {};
    const yes = (raw.yes ?? []).slice(0, depth).map(([price, size]) => ({
      price: price ?? 0,
      size: size ?? 0,
    }));
    const no = (raw.no ?? []).slice(0, depth).map(([price, size]) => ({
      price: price ?? 0,
      size: size ?? 0,
    }));

    const bestYesBid = yes[0]?.price ?? 0;
    const bestYesAsk = no[0] ? 100 - no[0].price : 100;
    const yesMid = (bestYesBid + bestYesAsk) / 2;
    const spread = bestYesAsk - bestYesBid;

    const book: KalshiOrderBook = {
      yes,
      no,
      yesMid,
      spread: Math.max(0, spread),
      spreadBps: Math.max(0, Math.round(spread * 100)),
      impliedProbabilityPct: yesMid,
      yesBidDepth: yes.reduce((s, l) => s + l.size, 0),
      yesAskDepth: no.reduce((s, l) => s + l.size, 0),
    };

    await cacheSet(cacheKey, book, 30);
    return book;
  } catch (e) {
    log.warn("Kalshi orderbook fetch failed", {
      ticker, error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

// ── Candlestick / price history ────────────────────────────────────────

export interface KalshiCandlestick {
  ts: number;
  openPrice: number;
  closePrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
}

export async function getMarketCandlesticks(
  seriesTicker: string,
  ticker: string,
  hoursBack: number
): Promise<KalshiCandlestick[]> {
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - hoursBack * 3600;
  // Use 60-minute candles for periods up to 7d, daily otherwise
  const periodMinutes = hoursBack <= 168 ? 60 : 1440;
  const cacheKey = `kalshi:candles:${ticker}:${hoursBack}`;
  const cached = await cacheGet<KalshiCandlestick[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchJson<{
      candlesticks?: Array<{
        ts?: number;
        price?: { open?: number; close?: number; high?: number; low?: number };
        volume?: number;
      }>;
    }>(
      `${KALSHI_API}/series/${encodeURIComponent(seriesTicker)}/markets/candlesticks` +
      `?ticker=${encodeURIComponent(ticker)}&start_ts=${startTs}&end_ts=${endTs}` +
      `&period_interval=${periodMinutes}`
    );

    const candles = (data.candlesticks ?? []).map((c) => ({
      ts: c.ts ?? 0,
      openPrice: c.price?.open ?? 0,
      closePrice: c.price?.close ?? 0,
      highPrice: c.price?.high ?? 0,
      lowPrice: c.price?.low ?? 0,
      volume: c.volume ?? 0,
    }));

    const ttl = hoursBack <= 24 ? 60 : 300;
    await cacheSet(cacheKey, candles, ttl);
    return candles;
  } catch (e) {
    log.warn("Kalshi candlesticks fetch failed", {
      ticker, error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}
