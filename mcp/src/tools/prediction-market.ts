import {
  getMarketDetail,
  getMarketPriceHistory,
  getOrderBook,
  type PolymarketMarket,
  type PolymarketPricePoint,
  type PriceHistoryInterval,
} from "../data/polymarket.js";
import { SyeniteError } from "../errors.js";

export const predictionMarketDescription = `Deep drill-down on a single Polymarket market.
Returns market title, question, outcomes, current prices, odds history (24h/7d/30d), volume curves,
liquidity depth, close time, resolution criteria, one-sided flow, and implied probability.
Input: slug, conditionId, or marketId (at least one required). Use after prediction.trending or prediction.search.`;

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function filterHistorySince(history: PolymarketPricePoint[], hoursAgo: number): PolymarketPricePoint[] {
  const cutoff = Math.floor(Date.now() / 1000) - hoursAgo * 3600;
  return history.filter((p) => p.timestamp >= cutoff);
}

interface HistoryStats {
  pointCount: number;
  openPrice: number;
  closePrice: number;
  minPrice: number;
  maxPrice: number;
  changePct: number;
}

function summariseHistory(points: PolymarketPricePoint[]): HistoryStats | null {
  if (points.length === 0) return null;
  const open = points[0].price;
  const close = points[points.length - 1].price;
  let min = open;
  let max = open;
  for (const p of points) {
    if (p.price < min) min = p.price;
    if (p.price > max) max = p.price;
  }
  const changePct = open > 0 ? ((close - open) / open) * 100 : 0;
  return {
    pointCount: points.length,
    openPrice: round(open, 4),
    closePrice: round(close, 4),
    minPrice: round(min, 4),
    maxPrice: round(max, 4),
    changePct: round(changePct, 2),
  };
}

interface PriceHistoryFetch {
  tokenId: string;
  interval: PriceHistoryInterval;
  buckets: Array<{ windowHours: number; label: string }>;
}

async function fetchOddsHistory(req: PriceHistoryFetch): Promise<Record<string, HistoryStats | null>> {
  const full = await getMarketPriceHistory(req.tokenId, req.interval);
  const result: Record<string, HistoryStats | null> = {};
  for (const bucket of req.buckets) {
    const slice = filterHistorySince(full, bucket.windowHours);
    result[bucket.label] = summariseHistory(slice);
  }
  return result;
}

function resolveTokenId(market: PolymarketMarket): string | undefined {
  return market.clobTokenIds?.[0];
}

function computeOneSidedFlow(bidDepthUSD: number, askDepthUSD: number): {
  direction: "bid-heavy" | "ask-heavy" | "balanced";
  ratio: number;
} {
  const total = bidDepthUSD + askDepthUSD;
  if (total === 0) return { direction: "balanced", ratio: 1 };
  const ratio = bidDepthUSD / askDepthUSD;
  if (ratio > 1.5) return { direction: "bid-heavy", ratio: round(ratio, 2) };
  if (ratio < 0.67) return { direction: "ask-heavy", ratio: round(ratio, 2) };
  return { direction: "balanced", ratio: round(ratio, 2) };
}

export async function handlePredictionMarket(params: {
  slug?: string;
  conditionId?: string;
  marketId?: string;
}): Promise<Record<string, unknown>> {
  const identifier = params.slug ?? params.conditionId ?? params.marketId;
  if (!identifier) {
    throw SyeniteError.invalidInput("One of slug, conditionId, or marketId is required.");
  }

  const market = await getMarketDetail(identifier);
  if (!market) {
    return {
      identifier,
      error: "Market not found. Verify the slug, conditionId, or marketId is correct.",
      timestamp: new Date().toISOString(),
    };
  }

  const tokenId = resolveTokenId(market);
  const book = tokenId ? await getOrderBook(tokenId) : null;

  const oddsHistory = tokenId
    ? await fetchOddsHistory({
        tokenId,
        interval: "max",
        buckets: [
          { windowHours: 24, label: "24h" },
          { windowHours: 24 * 7, label: "7d" },
          { windowHours: 24 * 30, label: "30d" },
        ],
      })
    : { "24h": null, "7d": null, "30d": null };

  const flow = book
    ? computeOneSidedFlow(book.bidDepthUSD, book.askDepthUSD)
    : { direction: "balanced" as const, ratio: 1 };

  const impliedProbability = market.outcomePrices[0]
    ? round(Number(market.outcomePrices[0]) * 100, 2)
    : null;

  const hoursToClose = market.endDate
    ? Math.max(0, (new Date(market.endDate).getTime() - Date.now()) / 3_600_000)
    : null;

  return {
    source: "Polymarket",
    market: {
      id: market.id,
      slug: market.slug,
      conditionId: market.conditionId,
      question: market.question,
      description: market.description ?? "",
      resolutionCriteria: market.description ?? "Not provided by Gamma API.",
      active: market.active,
      closed: market.closed,
      endDate: market.endDate ?? null,
      hoursToClose: hoursToClose !== null ? round(hoursToClose, 1) : null,
      outcomes: market.outcomes.map((outcome, i) => ({
        name: outcome,
        tokenId: market.clobTokenIds?.[i] ?? null,
        currentPrice: round(Number(market.outcomePrices[i] ?? 0), 4),
        probabilityPct: round(Number(market.outcomePrices[i] ?? 0) * 100, 2),
      })),
    },
    oddsHistory,
    volume: {
      total: round(market.volume),
      volume24h: round(market.volume24hr ?? 0),
    },
    liquidity: {
      totalUSD: round(market.liquidity),
      bestBid: round(market.bestBid, 4),
      bestAsk: round(market.bestAsk, 4),
      spread: round(market.spread, 4),
      spreadBps: round(market.spread * 10_000, 0),
      bidDepthUSD: book ? round(book.bidDepthUSD) : 0,
      askDepthUSD: book ? round(book.askDepthUSD) : 0,
      flow,
    },
    impliedProbabilityPct: impliedProbability,
    fairValue: {
      note: "No independent fair-value oracle — omitted. Compare impliedProbability to external signals or prediction.signals.",
    },
    timestamp: new Date().toISOString(),
    note: "Odds history shows open/close/min/max within each window. oneDayPriceChange in volume is Gamma's 24h shift.",
  };
}
