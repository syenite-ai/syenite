import { getTrendingEvents, type KalshiEvent, type KalshiMarket } from "../data/kalshi.js";

export const kalshiSignalsDescription = `Scans open Kalshi events and returns ranked actionable signals across five categories: wide_spread (bid-ask gap above 4¢ with meaningful liquidity — market-making opportunity), extreme_probability (YES ask above 92¢ or below 8¢ with volume — contrarian or long-shot play), high_volume (volume_24h above 10,000 contracts — active price discovery), near_resolution (market closing within 48 hours — time-sensitive opportunity), and mispriced (mutually exclusive event markets don't sum to ~100¢ — arbitrage opportunity). Returns each signal with strength (0–100), affected market ticker, and a suggested action. Optionally filter by minStrength (0–100), types (array of signal type strings), and limit (default 20, max 50). Signals are heuristic — verify market fundamentals before trading.`;

type SignalType =
  | "wide_spread"
  | "extreme_probability"
  | "high_volume"
  | "near_resolution"
  | "mispriced";

interface Signal {
  type: SignalType;
  strength: number;
  ticker: string;
  eventTicker: string;
  title: string;
  question: string;
  action: string;
  data: Record<string, unknown>;
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function detectSignals(event: KalshiEvent): Signal[] {
  const signals: Signal[] = [];

  const openMarkets = event.markets.filter((m) => m.status === "open");

  for (const m of openMarkets) {
    const spreadCents = m.yesAsk - m.yesBid;
    const liquidityUSD = m.liquidityCents / 100;

    // Wide spread — market-making opportunity
    if (spreadCents > 4 && liquidityUSD > 500) {
      const edgePerTrade = spreadCents / 2;
      signals.push({
        type: "wide_spread",
        strength: Math.min(spreadCents * 5, 100),
        ticker: m.ticker,
        eventTicker: event.eventTicker,
        title: event.title,
        question: m.title,
        action: `Market making: ${spreadCents}¢ spread. Bid ${m.yesBid}¢ / ask ${m.yesAsk}¢ to capture ~${edgePerTrade}¢ per side.`,
        data: {
          spreadCents,
          spreadBps: spreadCents * 100,
          yesBid: m.yesBid,
          yesAsk: m.yesAsk,
          liquidityUSD: round(liquidityUSD),
          volume: m.volume,
        },
      });
    }

    // Extreme probability — contrarian or long-shot
    const prob = m.yesAsk;  // cents = implied probability
    if (prob > 92 && m.volume > 5000) {
      const noPrice = 100 - prob;
      signals.push({
        type: "extreme_probability",
        strength: prob,
        ticker: m.ticker,
        eventTicker: event.eventTicker,
        title: event.title,
        question: m.title,
        action: `YES at ${prob}¢ (~${prob}%). Buying NO at ${noPrice}¢ offers ${round(100 / noPrice, 1)}× return if NO resolves.`,
        data: {
          impliedProbabilityPct: prob,
          noPrice,
          payoutMultiple: round(100 / Math.max(noPrice, 1), 1),
          volume: m.volume,
        },
      });
    }
    if (prob < 8 && prob > 1 && m.volume > 5000) {
      signals.push({
        type: "extreme_probability",
        strength: 100 - prob,
        ticker: m.ticker,
        eventTicker: event.eventTicker,
        title: event.title,
        question: m.title,
        action: `YES at ${prob}¢ — long-shot. Pays ${round(100 / Math.max(prob, 1), 1)}× if YES resolves.`,
        data: {
          impliedProbabilityPct: prob,
          payoutMultiple: round(100 / Math.max(prob, 1), 1),
          volume: m.volume,
        },
      });
    }

    // High 24h volume — active price discovery
    if (m.volume24h > 10_000) {
      const turnoverRatio = m.volume > 0 ? round(m.volume24h / m.volume, 2) : 0;
      signals.push({
        type: "high_volume",
        strength: Math.min(round(m.volume24h / 1000), 100),
        ticker: m.ticker,
        eventTicker: event.eventTicker,
        title: event.title,
        question: m.title,
        action: `High 24h activity: ${m.volume24h.toLocaleString()} contracts. Active price discovery in progress.`,
        data: {
          volume24h: m.volume24h,
          volumeTotal: m.volume,
          turnoverRatio,
          lastPrice: m.lastPrice,
        },
      });
    }

    // Near resolution — time-sensitive
    if (m.closeTime) {
      const hoursToClose = (new Date(m.closeTime).getTime() - Date.now()) / 3_600_000;
      if (hoursToClose > 0 && hoursToClose <= 48) {
        const urgency = Math.min(round((48 - hoursToClose) / 48 * 100), 100);
        signals.push({
          type: "near_resolution",
          strength: urgency,
          ticker: m.ticker,
          eventTicker: event.eventTicker,
          title: event.title,
          question: m.title,
          action: `Closes in ${round(hoursToClose, 1)}h. YES at ${m.yesAsk}¢ — time to act or exit.`,
          data: {
            hoursToClose: round(hoursToClose, 1),
            closeTime: m.closeTime,
            yesAsk: m.yesAsk,
            volume: m.volume,
            openInterest: m.openInterest,
          },
        });
      }
    }
  }

  // Mispriced — mutually exclusive markets don't sum to ~100¢
  if (event.mutuallyExclusive && openMarkets.length > 1) {
    const totalProb = openMarkets.reduce((s, m) => s + m.yesAsk, 0);
    const deviation = Math.abs(totalProb - 100);
    if (deviation > 4 && openMarkets.every((m) => m.volume > 1000)) {
      const direction = totalProb > 100 ? "overround" : "underround";
      signals.push({
        type: "mispriced",
        strength: Math.min(deviation * 5, 100),
        ticker: openMarkets[0].ticker,
        eventTicker: event.eventTicker,
        title: event.title,
        question: `${event.title} — all ${openMarkets.length} outcomes`,
        action: direction === "overround"
          ? `Overround: outcomes sum to ${totalProb}¢ (${deviation}¢ above par). Sell all sides for ~${deviation}¢ per contract.`
          : `Underround: outcomes sum to ${totalProb}¢ (${deviation}¢ below par). Buy all sides for guaranteed ${deviation}¢ profit.`,
        data: {
          totalProbabilityCents: totalProb,
          deviation,
          direction,
          markets: openMarkets.map((m) => ({ ticker: m.ticker, yesAsk: m.yesAsk })),
        },
      });
    }
  }

  return signals;
}

export async function handleKalshiSignals(params: {
  minStrength?: number;
  types?: string[];
  limit?: number;
}): Promise<Record<string, unknown>> {
  const minStrength = params.minStrength ?? 0;
  const typeFilter = params.types?.length ? new Set(params.types) : null;
  const limit = Math.min(params.limit ?? 20, 50);

  const events = await getTrendingEvents(50);

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
    source: "Kalshi",
    marketsScanned: events.reduce((sum, e) => sum + e.markets.length, 0),
    signalCount: allSignals.length,
    typeCounts,
    signals: allSignals.map((s) => ({
      type: s.type,
      strength: s.strength,
      ticker: s.ticker,
      eventTicker: s.eventTicker,
      title: s.title,
      question: s.question,
      action: s.action,
      ...s.data,
    })),
    signalTypes: {
      wide_spread: "Market making opportunity — bid-ask spread above 4¢ with liquidity",
      extreme_probability: "Outcome near certainty or near zero — contrarian or long-shot play",
      high_volume: "High 24h trading activity — active price discovery underway",
      near_resolution: "Market closes within 48 hours — time-sensitive position",
      mispriced: "Mutually exclusive outcomes don't sum to 100¢ — arbitrage opportunity",
    },
    timestamp: new Date().toISOString(),
    note: "Signals are heuristic. Kalshi is US-regulated — account required to trade. Prices in cents. — syenite.ai",
  };
}
