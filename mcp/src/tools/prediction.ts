import {
  getTrendingMarkets,
  searchMarkets,
  getOrderBook,
  type PolymarketEvent,
} from "../data/polymarket.js";

export const predictionTrendingDescription = `Fetches the top trending prediction markets on Polymarket ranked by trading volume, returning market titles, current outcome probabilities (derived from CLOB token prices as 0–100% values), total volume and liquidity in USDC, and bid-ask spread per market. Use this as the starting point for prediction market discovery — call before prediction.market, prediction.book, prediction.quote, or prediction.order to obtain market slugs and token IDs. Optionally pass limit (1–25, default 10) to control result count. Data is live from Polymarket's Gamma API and reflects current on-chain state.`;

export const predictionSearchDescription = `Searches Polymarket markets by topic keyword and returns matching events with current outcome probabilities, volume, liquidity, and order book metrics including best bid, ask, and spread. Use this when looking for a specific real-world event (elections, crypto price levels, sports outcomes, geopolitical events) rather than browsing by volume. Requires query (the search term); optionally pass limit (1–25, default 10). Returns market slugs and token IDs needed for prediction.market, prediction.book, prediction.quote, and prediction.order.`;

export const predictionBookDescription = `Fetches the current CLOB order book for a specific Polymarket outcome token, returning top bid and ask levels with sizes, mid-price, spread in both decimal and basis points, and total bid/ask depth in USD. Use this to assess execution quality and market-making opportunities before placing an order — wide spreads indicate higher edge for makers; shallow depth signals potential slippage on larger size. Requires tokenId, which is obtained from the clobTokenIds field in prediction.trending or prediction.search results. Does not place or modify orders.`;

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
