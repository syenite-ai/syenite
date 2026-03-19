import {
  getTrendingMarkets,
  searchMarkets,
  getOrderBook,
  type PolymarketEvent,
} from "../data/polymarket.js";

export const predictionTrendingDescription = `Get trending prediction markets on Polymarket, ranked by volume.
Returns market titles, current probabilities (outcome prices), volume, liquidity, and spread.
Use this for discovering active markets and identifying trading opportunities.`;

export const predictionSearchDescription = `Search prediction markets on Polymarket by topic.
Returns matching markets with probabilities, volume, liquidity, and order book metrics.
Good for finding specific events (elections, crypto prices, sports, geopolitics).`;

export const predictionBookDescription = `Get the order book for a specific Polymarket outcome token.
Returns top bids/asks, spread, mid-price, and depth. Use for assessing execution quality and market making opportunities.
Requires a Polymarket token ID (from the markets returned by prediction.trending or prediction.search).`;

function formatEvent(e: PolymarketEvent): Record<string, unknown> {
  return {
    id: e.id,
    title: e.title,
    slug: e.slug,
    active: e.active,
    volume: round(e.volume),
    liquidity: round(e.liquidity),
    markets: e.markets.map((m) => ({
      id: m.id,
      question: m.question,
      conditionId: m.conditionId,
      outcomes: m.outcomes.map((outcome, i) => ({
        name: outcome,
        probability: round(Number(m.outcomePrices[i] ?? 0) * 100),
      })),
      volume: round(m.volume),
      liquidity: round(m.liquidity),
      bestBid: round(m.bestBid, 4),
      bestAsk: round(m.bestAsk, 4),
      spread: round(m.spread, 4),
      lastTradePrice: round(m.lastTradePrice, 4),
    })),
  };
}

export async function handlePredictionTrending(params: {
  limit?: number;
}): Promise<Record<string, unknown>> {
  const limit = Math.min(params.limit ?? 10, 25);
  const events = await getTrendingMarkets(limit);

  return {
    source: "Polymarket",
    eventCount: events.length,
    events: events.map(formatEvent),
    timestamp: new Date().toISOString(),
    note: "Probabilities are derived from outcome token prices (0-100%). Volume and liquidity in USDC.",
  };
}

export async function handlePredictionSearch(params: {
  query: string;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const limit = Math.min(params.limit ?? 10, 25);
  const events = await searchMarkets(params.query, limit);

  return {
    source: "Polymarket",
    query: params.query,
    resultCount: events.length,
    events: events.map(formatEvent),
    timestamp: new Date().toISOString(),
  };
}

export async function handlePredictionBook(params: {
  tokenId: string;
}): Promise<Record<string, unknown>> {
  const book = await getOrderBook(params.tokenId);

  if (!book) {
    return {
      tokenId: params.tokenId,
      error: "Order book not available. Verify the token ID is correct.",
      timestamp: new Date().toISOString(),
    };
  }

  return {
    tokenId: params.tokenId,
    midPrice: round(book.midPrice, 4),
    spread: round(book.spread, 4),
    spreadBps: round(book.spread * 10000, 0),
    bidDepthUSD: round(book.bidDepthUSD),
    askDepthUSD: round(book.askDepthUSD),
    bids: book.bids.map((b) => ({ price: round(b.price, 4), size: round(b.size) })),
    asks: book.asks.map((a) => ({ price: round(a.price, 4), size: round(a.size) })),
    timestamp: new Date().toISOString(),
    note: "Prices are in USDC. Spread in basis points. Depth is total USD value at each side.",
  };
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
