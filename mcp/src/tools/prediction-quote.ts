import { getOrderBook, type OrderBookSummary } from "../data/polymarket.js";
import { SyeniteError } from "../errors.js";

export const predictionQuoteDescription = `Get a size-aware quote for a Polymarket order.
Walks the CLOB order book to compute average fill price, slippage from mid, and available depth.
Inputs: tokenId, side (buy/sell), outcome (YES/NO informational), size in shares, optional
orderType and limitPrice. Polymarket CLOB charges 0 maker/taker fees at time of writing.`;

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

interface FillResult {
  filledSize: number;
  totalCost: number;
  avgPrice: number;
  levelsConsumed: number;
  fullyFilled: boolean;
}

function walkBook(
  levels: Array<{ price: number; size: number }>,
  size: number,
  side: "buy" | "sell"
): FillResult {
  const ordered = side === "buy"
    ? [...levels].sort((a, b) => a.price - b.price)   // buy hits asks ascending
    : [...levels].sort((a, b) => b.price - a.price);  // sell hits bids descending

  let filledSize = 0;
  let totalCost = 0;
  let levelsConsumed = 0;

  for (const level of ordered) {
    if (filledSize >= size) break;
    const take = Math.min(level.size, size - filledSize);
    filledSize += take;
    totalCost += take * level.price;
    levelsConsumed++;
  }

  return {
    filledSize: round(filledSize, 4),
    totalCost: round(totalCost, 4),
    avgPrice: filledSize > 0 ? round(totalCost / filledSize, 4) : 0,
    levelsConsumed,
    fullyFilled: filledSize >= size - 1e-9,
  };
}

function computeSlippage(avgPrice: number, midPrice: number, side: "buy" | "sell"): number {
  if (midPrice <= 0) return 0;
  const diff = side === "buy" ? avgPrice - midPrice : midPrice - avgPrice;
  return round((diff / midPrice) * 100, 2);
}

export async function handlePredictionQuote(params: {
  tokenId: string;
  side: "buy" | "sell";
  outcome: "YES" | "NO";
  size: number;
  orderType?: "market" | "limit";
  limitPrice?: number;
}): Promise<Record<string, unknown>> {
  if (!params.tokenId) throw SyeniteError.invalidInput("tokenId is required.");
  if (!["buy", "sell"].includes(params.side)) {
    throw SyeniteError.invalidInput("side must be 'buy' or 'sell'.");
  }
  if (!(params.size > 0)) throw SyeniteError.invalidInput("size must be positive.");
  if (params.orderType === "limit" && params.limitPrice === undefined) {
    throw SyeniteError.invalidInput("limitPrice required for limit orders.");
  }

  const book: OrderBookSummary | null = await getOrderBook(params.tokenId);
  if (!book) {
    return {
      tokenId: params.tokenId, side: params.side, outcome: params.outcome, size: params.size,
      error: "Order book unavailable. Verify tokenId.",
      timestamp: new Date().toISOString(),
    };
  }

  const relevantSide = params.side === "buy" ? book.asks : book.bids;
  const fill = walkBook(relevantSide, params.size, params.side);
  const slippagePct = computeSlippage(fill.avgPrice, book.midPrice, params.side);

  const depthAvailable = relevantSide.reduce((s, l) => s + l.size, 0);
  const fees = {
    makerBps: 0,
    takerBps: 0,
    estimatedUSD: 0,
    note: "Polymarket CLOB currently zero-fee.",
  };

  const limitCheck = params.orderType === "limit" && params.limitPrice !== undefined
    ? {
        limitPrice: params.limitPrice,
        respectsLimit: params.side === "buy"
          ? fill.avgPrice <= params.limitPrice
          : fill.avgPrice >= params.limitPrice,
      }
    : null;

  return {
    tokenId: params.tokenId,
    side: params.side,
    outcome: params.outcome,
    size: params.size,
    orderType: params.orderType ?? "market",
    midPrice: round(book.midPrice, 4),
    avgFillPrice: fill.avgPrice,
    expectedFill: {
      size: fill.filledSize,
      totalCostUSD: fill.totalCost,
      levelsConsumed: fill.levelsConsumed,
      fullyFilled: fill.fullyFilled,
    },
    slippagePct,
    slippageBps: round(slippagePct * 100, 0),
    depthAvailable: round(depthAvailable, 4),
    fees,
    limitCheck,
    warnings: [
      ...(fill.fullyFilled ? [] : [`Order book only supports ${fill.filledSize} shares — partial fill only.`]),
      ...(Math.abs(slippagePct) > 5 ? [`Slippage ${slippagePct.toFixed(2)}% exceeds 5% — consider reducing size.`] : []),
    ],
    timestamp: new Date().toISOString(),
    note: "Prices in USDC per share (0-1). Fees are subject to change — verify at clob.polymarket.com.",
  };
}
