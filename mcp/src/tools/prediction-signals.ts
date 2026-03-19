import {
  getTrendingMarkets,
  getOrderBook,
  type PolymarketEvent,
  type PolymarketMarket,
} from "../data/polymarket.js";
import { log } from "../logging/logger.js";

export const predictionSignalsDescription = `Detect actionable signals across prediction markets — volume spikes, wide spreads, extreme probabilities, and high-conviction opportunities.
Scans Polymarket for markets where agents can profit: market making on wide spreads, fading extremes, or riding momentum.
Returns ranked signals with signal type, strength, and suggested action. Use this for autonomous prediction market strategy discovery.`;

type SignalType = "wide_spread" | "extreme_probability" | "high_volume" | "deep_liquidity" | "mispriced";

interface Signal {
  type: SignalType;
  strength: number;
  market: string;
  question: string;
  action: string;
  data: Record<string, unknown>;
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function detectSignals(event: PolymarketEvent): Signal[] {
  const signals: Signal[] = [];

  for (const m of event.markets) {
    if (!m.active || m.closed) continue;

    // Wide spread = market making opportunity
    if (m.spread > 0.04 && m.liquidity > 5000) {
      const edgePerTrade = m.spread / 2;
      const dailyTurns = Math.min(m.volume / Math.max(m.liquidity, 1), 10);
      signals.push({
        type: "wide_spread",
        strength: Math.min(round(m.spread * 100), 100),
        market: event.title,
        question: m.question,
        action: `Market making opportunity: ${round(m.spread * 100)}% spread. Place bids at ${round(m.bestBid, 3)} / asks at ${round(m.bestAsk, 3)} to capture ~${round(edgePerTrade * 100)}% per side.`,
        data: {
          spread: round(m.spread, 4),
          spreadBps: round(m.spread * 10000),
          bestBid: round(m.bestBid, 4),
          bestAsk: round(m.bestAsk, 4),
          liquidity: round(m.liquidity),
          volume: round(m.volume),
          dailyTurnover: round(dailyTurns),
        },
      });
    }

    // Extreme probabilities — potential contrarian plays
    const prices = m.outcomePrices.map(Number);
    for (let i = 0; i < prices.length; i++) {
      const prob = prices[i];
      if (prob > 0.92 && m.volume > 10000) {
        signals.push({
          type: "extreme_probability",
          strength: round(prob * 100),
          market: event.title,
          question: m.question,
          action: `"${m.outcomes[i]}" at ${round(prob * 100)}% — if you disagree, buying "No" at ${round((1 - prob) * 100)}¢ offers ${round(1 / (1 - prob))}x return.`,
          data: {
            outcome: m.outcomes[i],
            probability: round(prob * 100),
            contrarian_price: round(1 - prob, 4),
            payout_multiple: round(1 / (1 - prob)),
            volume: round(m.volume),
          },
        });
      }
      if (prob < 0.08 && prob > 0.01 && m.volume > 10000) {
        signals.push({
          type: "extreme_probability",
          strength: round((1 - prob) * 100),
          market: event.title,
          question: m.question,
          action: `"${m.outcomes[i]}" at ${round(prob * 100)}¢ — long-shot bet offers ${round(1 / prob)}x return if correct.`,
          data: {
            outcome: m.outcomes[i],
            probability: round(prob * 100),
            payout_multiple: round(1 / prob),
            volume: round(m.volume),
          },
        });
      }
    }

    // High volume relative to liquidity — momentum / active trading
    if (m.volume > 0 && m.liquidity > 0) {
      const turnover = m.volume / m.liquidity;
      if (turnover > 5 && m.volume > 50000) {
        signals.push({
          type: "high_volume",
          strength: Math.min(round(turnover * 10), 100),
          market: event.title,
          question: m.question,
          action: `High activity: ${round(turnover)}x turnover ratio. Volume $${round(m.volume).toLocaleString()} vs $${round(m.liquidity).toLocaleString()} liquidity — active price discovery.`,
          data: {
            volume: round(m.volume),
            liquidity: round(m.liquidity),
            turnoverRatio: round(turnover),
            lastPrice: round(m.lastTradePrice, 4),
          },
        });
      }
    }

    // Deep liquidity — safe for larger positions
    if (m.liquidity > 100000) {
      signals.push({
        type: "deep_liquidity",
        strength: Math.min(round(m.liquidity / 10000), 100),
        market: event.title,
        question: m.question,
        action: `Deep liquidity ($${round(m.liquidity).toLocaleString()}) — safe for larger position sizes with minimal slippage.`,
        data: {
          liquidity: round(m.liquidity),
          volume: round(m.volume),
          spread: round(m.spread, 4),
        },
      });
    }

    // Mispriced: outcomes don't sum to ~100% (skip if prices are missing/zero)
    const totalProb = prices.reduce((s, p) => s + p, 0);
    if (totalProb > 0.1 && Math.abs(totalProb - 1.0) > 0.03 && m.volume > 5000) {
      const overround = round((totalProb - 1.0) * 100);
      signals.push({
        type: "mispriced",
        strength: round(Math.abs(totalProb - 1.0) * 100),
        market: event.title,
        question: m.question,
        action: totalProb > 1.0
          ? `Overround of ${overround}% — outcomes sum to ${round(totalProb * 100)}%. Sell all sides for guaranteed ${overround}% profit if possible.`
          : `Underround of ${Math.abs(overround)}% — outcomes sum to ${round(totalProb * 100)}%. Buy all sides for guaranteed ${Math.abs(overround)}% profit.`,
        data: {
          outcomes: m.outcomes.map((o, i) => ({ name: o, probability: round(prices[i] * 100) })),
          totalProbability: round(totalProb * 100),
          edge: round(Math.abs(totalProb - 1.0) * 100),
        },
      });
    }
  }

  return signals;
}

export async function handlePredictionSignals(params: {
  minStrength?: number;
  types?: string[];
  limit?: number;
}): Promise<Record<string, unknown>> {
  const minStrength = params.minStrength ?? 0;
  const typeFilter = params.types?.length ? new Set(params.types) : null;
  const limit = Math.min(params.limit ?? 20, 50);

  const events = await getTrendingMarkets(25);

  let allSignals: Signal[] = [];
  for (const event of events) {
    allSignals.push(...detectSignals(event));
  }

  if (typeFilter) {
    allSignals = allSignals.filter((s) => typeFilter.has(s.type));
  }
  allSignals = allSignals.filter((s) => s.strength >= minStrength);
  allSignals.sort((a, b) => b.strength - a.strength);
  allSignals = allSignals.slice(0, limit);

  const typeCounts: Record<string, number> = {};
  for (const s of allSignals) {
    typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1;
  }

  return {
    source: "Polymarket",
    marketsScanned: events.reduce((sum, e) => sum + e.markets.length, 0),
    signalCount: allSignals.length,
    typeCounts,
    signals: allSignals.map((s) => ({
      type: s.type,
      strength: s.strength,
      market: s.market,
      question: s.question,
      action: s.action,
      ...s.data,
    })),
    signalTypes: {
      wide_spread: "Market making opportunity — place orders on both sides of a wide bid-ask spread",
      extreme_probability: "Outcome near certainty or near zero — contrarian or momentum play",
      high_volume: "High trading activity relative to liquidity — active price discovery",
      deep_liquidity: "Large liquidity pool — safe for bigger positions",
      mispriced: "Outcome probabilities don't sum to 100% — arbitrage opportunity",
    },
    timestamp: new Date().toISOString(),
    note: "Signals are heuristic — higher strength means stronger signal. Always verify market fundamentals before trading. — syenite.ai",
  };
}
