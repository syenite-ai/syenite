import {
  getMarketByTicker,
  getEventDetail,
  getOrderBook,
  getMarketCandlesticks,
  type KalshiCandlestick,
} from "../data/kalshi.js";
import { SyeniteError } from "../errors.js";

export const kalshiMarketDescription = `Provides a comprehensive deep-dive on a single Kalshi market by ticker, returning the question, current YES/NO prices in cents, implied probability, 24h and 7d price history stats (open, close, min, max, change), volume in contracts with approximate USD value, liquidity, order book depth, bid-ask spread, one-sided flow direction, resolution rules, and time remaining until close. Use this after kalshi.trending or kalshi.search to fully evaluate a market before taking a position. Requires ticker (e.g. "KXBTC-25DEC31-T100000"). Does not place orders.`;

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

interface HistoryStats {
  pointCount: number;
  openPrice: number;
  closePrice: number;
  minPrice: number;
  maxPrice: number;
  changePct: number;
}

function summariseCandles(candles: KalshiCandlestick[]): HistoryStats | null {
  if (candles.length === 0) return null;
  const open = candles[0].openPrice;
  const close = candles[candles.length - 1].closePrice;
  let min = open;
  let max = open;
  for (const c of candles) {
    if (c.lowPrice < min) min = c.lowPrice;
    if (c.highPrice > max) max = c.highPrice;
  }
  const changePct = open > 0 ? ((close - open) / open) * 100 : 0;
  return {
    pointCount: candles.length,
    openPrice: open,
    closePrice: close,
    minPrice: min,
    maxPrice: max,
    changePct: round(changePct),
  };
}

function computeFlow(yesBidDepth: number, yesAskDepth: number): {
  direction: "bid-heavy" | "ask-heavy" | "balanced";
  ratio: number;
} {
  const total = yesBidDepth + yesAskDepth;
  if (total === 0) return { direction: "balanced", ratio: 1 };
  const ratio = yesBidDepth / Math.max(yesAskDepth, 1);
  if (ratio > 1.5) return { direction: "bid-heavy", ratio: round(ratio) };
  if (ratio < 0.67) return { direction: "ask-heavy", ratio: round(ratio) };
  return { direction: "balanced", ratio: round(ratio) };
}

export async function handleKalshiMarket(params: {
  ticker: string;
}): Promise<Record<string, unknown>> {
  if (!params.ticker) {
    throw SyeniteError.invalidInput("ticker is required.");
  }

  const market = await getMarketByTicker(params.ticker);
  if (!market) {
    return {
      ticker: params.ticker,
      error: "Market not found. Verify the ticker is correct.",
      timestamp: new Date().toISOString(),
    };
  }

  // Fetch order book and candlestick history in parallel
  const [book, candles24h, candles7d] = await Promise.all([
    getOrderBook(market.ticker),
    getMarketCandlesticks(market.eventTicker.split("-")[0] ?? market.eventTicker, market.ticker, 24),
    getMarketCandlesticks(market.eventTicker.split("-")[0] ?? market.eventTicker, market.ticker, 168),
  ]);

  const history24h = summariseCandles(candles24h);
  const history7d = summariseCandles(candles7d);

  // Fall back to previous_price if candles unavailable
  const fallback24hChange = market.previousPrice > 0
    ? round(((market.lastPrice - market.previousPrice) / market.previousPrice) * 100)
    : null;

  const flow = book
    ? computeFlow(book.yesBidDepth, book.yesAskDepth)
    : { direction: "balanced" as const, ratio: 1 };

  const hoursToClose = market.closeTime
    ? Math.max(0, (new Date(market.closeTime).getTime() - Date.now()) / 3_600_000)
    : null;

  // Approximate dollar volume: contracts × avg price in dollars
  const avgPriceDollars = (market.yesBid + market.yesAsk) / 2 / 100;
  const approxVolumeUSD = round(market.volume * avgPriceDollars);
  const approxVolume24hUSD = round(market.volume24h * avgPriceDollars);

  // Fetch sibling markets for context
  const event = market.eventTicker
    ? await getEventDetail(market.eventTicker)
    : null;

  return {
    source: "Kalshi",
    market: {
      ticker: market.ticker,
      eventTicker: market.eventTicker,
      seriesTicker: market.eventTicker.split("-")[0] ?? "",
      title: market.title,
      subtitle: market.subtitle,
      category: market.category,
      status: market.status,
      result: market.result ?? null,
      closeTime: market.closeTime,
      expirationTime: market.expirationTime,
      hoursToClose: hoursToClose !== null ? round(hoursToClose, 1) : null,
      rulesPrimary: market.rulesPrimary,
      rulesSecondary: market.rulesSecondary,
      pricing: {
        yesBid: market.yesBid,
        yesAsk: market.yesAsk,
        noBid: market.noBid,
        noAsk: market.noAsk,
        lastPrice: market.lastPrice,
        previousPrice: market.previousPrice,
        impliedProbabilityPct: market.yesAsk,
        change24hPct: history24h ? history24h.changePct : fallback24hChange,
      },
    },
    priceHistory: {
      "24h": history24h,
      "7d": history7d,
      note: history24h
        ? "History from Kalshi candlesticks."
        : "Candlestick history unavailable — showing 24h change from previous_price field.",
    },
    volume: {
      totalContracts: market.volume,
      contracts24h: market.volume24h,
      approxUSD: approxVolumeUSD,
      approxUSD24h: approxVolume24hUSD,
    },
    liquidity: {
      liquidityUSD: round(market.liquidityCents / 100),
      openInterest: market.openInterest,
      yesBid: market.yesBid,
      yesAsk: market.yesAsk,
      spreadCents: market.yesAsk - market.yesBid,
      spreadBps: (market.yesAsk - market.yesBid) * 100,
      yesBidDepthContracts: book?.yesBidDepth ?? 0,
      yesAskDepthContracts: book?.yesAskDepth ?? 0,
      flow,
    },
    siblings: event
      ? event.markets
          .filter((m) => m.ticker !== market.ticker && m.status === "open")
          .slice(0, 5)
          .map((m) => ({
            ticker: m.ticker,
            title: m.title,
            yesAsk: m.yesAsk,
            impliedProbabilityPct: m.yesAsk,
            volume: m.volume,
          }))
      : [],
    timestamp: new Date().toISOString(),
    note: "Prices in cents (0–99). 1 contract pays $1 if YES resolves, $0 if NO. impliedProbabilityPct ≈ cost to buy YES.",
  };
}
