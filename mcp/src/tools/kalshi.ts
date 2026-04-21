import {
  getTrendingEvents,
  searchEvents,
  getOrderBook,
  type KalshiEvent,
} from "../data/kalshi.js";

export const kalshiTrendingDescription = `Fetches the top open events on Kalshi ranked by recency, returning event titles, tickers, market questions, current YES/NO prices in cents, implied probability, volume in contracts, and liquidity. Kalshi is a US-regulated prediction market exchange — markets settle to $1 (YES) or $0 (NO). Use this as the starting point for Kalshi market discovery before calling kalshi.market, kalshi.book, or kalshi.signals. Optionally pass limit (1–50, default 25). Prices are in cents where 45¢ means ~45% implied probability of YES.`;

export const kalshiSearchDescription = `Searches open Kalshi events and markets by keyword, filtering against event titles, tickers, series names, and market subtitles. Use this when looking for a specific topic (elections, crypto price levels, economic data, sports). Requires query (search term); optionally pass limit (1–50, default 25). Returns tickers and market details needed for kalshi.market and kalshi.book. Note: Kalshi has no server-side text search — this filters a large fetch of open events client-side, so very rare topics may not appear.`;

export const kalshiBookDescription = `Fetches the current order book for a specific Kalshi market by ticker, returning YES and NO bid levels with sizes in contracts, mid-price, spread in cents and basis points, and total depth on each side. Use this to assess execution quality before sizing a position — wide spreads indicate higher edge for makers. Requires ticker (e.g. "KXBTC-25DEC31-T100000"), obtained from kalshi.trending or kalshi.search. Kalshi prices are in cents (0–99); a YES bid at 45 means you pay 45¢ per contract to win $1 if YES resolves.`;

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function formatEvent(e: KalshiEvent): Record<string, unknown> {
  return {
    eventTicker: e.eventTicker,
    seriesTicker: e.seriesTicker,
    title: e.title,
    subtitle: e.subtitle,
    category: e.category,
    mutuallyExclusive: e.mutuallyExclusive,
    markets: e.markets
      .filter((m) => m.status === "open")
      .map((m) => ({
        ticker: m.ticker,
        title: m.title,
        subtitle: m.subtitle,
        yesBid: m.yesBid,
        yesAsk: m.yesAsk,
        impliedProbabilityPct: m.yesAsk,  // cost to buy YES ≈ probability
        lastPrice: m.lastPrice,
        volume: m.volume,
        volume24h: m.volume24h,
        liquidityUSD: round(m.liquidityCents / 100),
        closeTime: m.closeTime,
      })),
  };
}

export async function handleKalshiTrending(params: {
  limit?: number;
}): Promise<Record<string, unknown>> {
  const limit = Math.min(params.limit ?? 25, 50);
  const events = await getTrendingEvents(limit);

  return {
    source: "Kalshi",
    eventCount: events.length,
    events: events.map(formatEvent),
    timestamp: new Date().toISOString(),
    note: "Prices in cents (0–99). impliedProbabilityPct ≈ yesAsk. Volume in contracts ($1 max payout each). Kalshi is US-regulated.",
  };
}

export async function handleKalshiSearch(params: {
  query: string;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const limit = Math.min(params.limit ?? 25, 50);
  const events = await searchEvents(params.query, limit);

  return {
    source: "Kalshi",
    query: params.query,
    resultCount: events.length,
    events: events.map(formatEvent),
    timestamp: new Date().toISOString(),
  };
}

export async function handleKalshiBook(params: {
  ticker: string;
}): Promise<Record<string, unknown>> {
  const book = await getOrderBook(params.ticker);

  if (!book) {
    return {
      ticker: params.ticker,
      error: "Order book not available. Verify the ticker is correct and the market is open.",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    ticker: params.ticker,
    impliedProbabilityPct: round(book.impliedProbabilityPct, 1),
    yesMidCents: round(book.yesMid, 1),
    spreadCents: round(book.spread, 1),
    spreadBps: book.spreadBps,
    yesBidDepthContracts: book.yesBidDepth,
    yesAskDepthContracts: book.yesAskDepth,
    yesBids: book.yes.map((l) => ({ priceCents: l.price, sizeContracts: l.size })),
    noAsks: book.no.map((l) => ({ priceCents: l.price, sizeContracts: l.size })),
    timestamp: new Date().toISOString(),
    note: "YES bids (willing to buy YES) and NO bids (willing to buy NO, equivalent to selling YES). Spread = yesAsk − yesBid. 1 contract pays $1 if YES resolves.",
  };
}
