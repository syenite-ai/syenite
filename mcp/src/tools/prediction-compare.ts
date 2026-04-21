import { searchMarkets, getTrendingMarkets, type PolymarketMarket } from "../data/polymarket.js";
import { searchEvents, getTrendingEvents, type KalshiEvent, type KalshiMarket } from "../data/kalshi.js";

export const predictionCompareDescription = `Searches both Polymarket and Kalshi for the same underlying question and returns a side-by-side comparison of implied probabilities, volume, liquidity, and spread. Use this to see where a question is listed on each exchange, whether prices agree, and which venue has better liquidity. Requires query (the topic to search — e.g. "Trump tariffs", "Bitcoin 100k", "Fed rate cut"). Optionally pass minOverlapPct (0–100, default 20) to control how strictly market titles must match across exchanges — lower values return more speculative matches. Returns matched pairs ranked by match confidence, each showing normalized implied probability (pct) on both sides and the price gap in percentage points.`;

export const predictionArbitrageDescription = `Scans trending markets on both Polymarket and Kalshi simultaneously, matches markets covering the same underlying question, and surfaces pairs where implied probabilities diverge by more than a threshold. A divergence of 5pp or more suggests one exchange is mispriced or lagging. Returns pairs ranked by divergence, each showing the YES probability on each exchange, which side is higher, and the spread in percentage points. Optionally pass minDivergencePp (default 3) to filter only meaningful gaps, and limit (default 20, max 50). Note: cross-exchange arb requires accounts on both platforms and faces execution risk — prices may converge before orders fill.`;

// ── Shared helpers ──────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "will", "the", "a", "an", "be", "is", "in", "on", "at", "to", "of", "for",
  "and", "or", "by", "vs", "with", "does", "has", "have", "was", "are", "its",
  "this", "that", "from", "not", "win", "lose", "get", "hit", "2024", "2025",
  "2026", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct",
  "nov", "dec",
]);

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function jaccardOverlap(a: string, b: string): number {
  const wa = tokenize(a);
  const wb = tokenize(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let intersect = 0;
  for (const w of wa) {
    if (wb.has(w)) intersect++;
  }
  const union = wa.size + wb.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function round(n: number, d = 2): number {
  return Math.round(n * 10 ** d) / 10 ** d;
}

// Normalize both exchanges to implied probability in pct (0–100)
// Polymarket: bestAsk is 0–1 float → multiply by 100
// Kalshi: yesAsk is already 0–99 cents ≈ pct
function polyProbPct(m: PolymarketMarket): number {
  const p = m.bestAsk > 0 ? m.bestAsk : (m.lastTradePrice > 0 ? m.lastTradePrice : 0);
  return round(p * 100, 1);
}

function kalshiProbPct(m: KalshiMarket): number {
  return round(m.yesAsk, 1);
}

// ── Flat market lists ───────────────────────────────────────────────────────

interface PolyFlat {
  eventTitle: string;
  question: string;
  slug: string;
  probPct: number;
  volume: number;
  volume24h: number;
  liquidityUSD: number;
  spreadBps: number;
}

interface KalshiFlat {
  eventTitle: string;
  eventTicker: string;
  question: string;
  ticker: string;
  probPct: number;
  volume: number;
  volume24h: number;
  liquidityUSD: number;
  spreadBps: number;
}

function flattenPoly(events: Awaited<ReturnType<typeof searchMarkets>>): PolyFlat[] {
  const out: PolyFlat[] = [];
  for (const ev of events) {
    for (const m of ev.markets) {
      if (!m.active || m.closed) continue;
      out.push({
        eventTitle: ev.title,
        question: m.question,
        slug: m.slug,
        probPct: polyProbPct(m),
        volume: m.volume,
        volume24h: m.volume24hr ?? 0,
        liquidityUSD: round(m.liquidity),
        spreadBps: round(m.spread * 10000),
      });
    }
  }
  return out;
}

function flattenKalshi(events: KalshiEvent[]): KalshiFlat[] {
  const out: KalshiFlat[] = [];
  for (const ev of events) {
    for (const m of ev.markets) {
      if (m.status !== "open") continue;
      out.push({
        eventTitle: ev.title,
        eventTicker: ev.eventTicker,
        question: m.title,
        ticker: m.ticker,
        probPct: kalshiProbPct(m),
        volume: m.volume,
        volume24h: m.volume24h,
        liquidityUSD: round(m.liquidityCents / 100),
        spreadBps: Math.round((m.yesAsk - m.yesBid) * 100),
      });
    }
  }
  return out;
}

// ── Best match ──────────────────────────────────────────────────────────────

interface MatchedPair {
  overlapPct: number;
  polymarket: PolyFlat;
  kalshi: KalshiFlat;
  polyProbPct: number;
  kalshiProbPct: number;
  divergencePp: number;
  higherOn: "polymarket" | "kalshi" | "equal";
}

function bestKalshiMatch(
  poly: PolyFlat,
  kalshiFlat: KalshiFlat[],
  minOverlap: number
): { match: KalshiFlat; overlap: number } | null {
  // Compare against both event title and individual market question
  const searchText = `${poly.eventTitle} ${poly.question}`;
  let bestScore = minOverlap;
  let best: KalshiFlat | null = null;

  for (const k of kalshiFlat) {
    const kText = `${k.eventTitle} ${k.question}`;
    const score = jaccardOverlap(searchText, kText);
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }

  return best ? { match: best, overlap: bestScore } : null;
}

function buildPairs(
  polyFlat: PolyFlat[],
  kalshiFlat: KalshiFlat[],
  minOverlapPct: number
): MatchedPair[] {
  const minOverlap = minOverlapPct / 100;
  const seen = new Set<string>();
  const pairs: MatchedPair[] = [];

  for (const poly of polyFlat) {
    const result = bestKalshiMatch(poly, kalshiFlat, minOverlap);
    if (!result) continue;

    const key = `${poly.slug}:${result.match.ticker}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const pp = poly.probPct;
    const kp = result.match.probPct;
    const divergence = round(Math.abs(pp - kp), 1);

    pairs.push({
      overlapPct: round(result.overlap * 100, 1),
      polymarket: poly,
      kalshi: result.match,
      polyProbPct: pp,
      kalshiProbPct: kp,
      divergencePp: divergence,
      higherOn: pp > kp + 0.5 ? "polymarket" : kp > pp + 0.5 ? "kalshi" : "equal",
    });
  }

  return pairs;
}

// ── Tool handlers ───────────────────────────────────────────────────────────

export async function handlePredictionCompare(params: {
  query: string;
  minOverlapPct?: number;
}): Promise<Record<string, unknown>> {
  const minOverlapPct = params.minOverlapPct ?? 20;

  const [polyEvents, kalshiEvents] = await Promise.all([
    searchMarkets(params.query, 25),
    searchEvents(params.query, 25),
  ]);

  const polyFlat = flattenPoly(polyEvents);
  const kalshiFlat = flattenKalshi(kalshiEvents);

  const pairs = buildPairs(polyFlat, kalshiFlat, minOverlapPct);
  pairs.sort((a, b) => b.overlapPct - a.overlapPct);

  // Also return unmatched markets from each side
  const matchedPolyTickers = new Set(pairs.map((p) => p.polymarket.slug));
  const matchedKalshiTickers = new Set(pairs.map((p) => p.kalshi.ticker));

  const unmatchedPoly = polyFlat
    .filter((p) => !matchedPolyTickers.has(p.slug))
    .map((p) => ({ exchange: "polymarket", question: p.question, probPct: p.probPct, slug: p.slug }));

  const unmatchedKalshi = kalshiFlat
    .filter((k) => !matchedKalshiTickers.has(k.ticker))
    .map((k) => ({ exchange: "kalshi", question: k.question, probPct: k.probPct, ticker: k.ticker }));

  return {
    query: params.query,
    matchedPairs: pairs.length,
    polymarketsFound: polyFlat.length,
    kalshiMarketsFound: kalshiFlat.length,
    pairs: pairs.map((pair) => ({
      matchConfidence: `${pair.overlapPct}%`,
      divergencePp: pair.divergencePp,
      higherOn: pair.higherOn,
      polymarket: {
        question: pair.polymarket.question,
        slug: pair.polymarket.slug,
        probPct: pair.polyProbPct,
        volume: pair.polymarket.volume,
        volume24h: pair.polymarket.volume24h,
        liquidityUSD: pair.polymarket.liquidityUSD,
        spreadBps: pair.polymarket.spreadBps,
      },
      kalshi: {
        question: pair.kalshi.question,
        ticker: pair.kalshi.ticker,
        probPct: pair.kalshiProbPct,
        volume: pair.kalshi.volume,
        volume24h: pair.kalshi.volume24h,
        liquidityUSD: pair.kalshi.liquidityUSD,
        spreadBps: pair.kalshi.spreadBps,
      },
    })),
    unmatchedMarkets: [...unmatchedPoly, ...unmatchedKalshi],
    timestamp: new Date().toISOString(),
    note: "Probabilities normalized to pct (0–100) on both exchanges. Polymarket prices are 0–1 floats × 100; Kalshi prices are cents (0–99). Match confidence is Jaccard keyword overlap on market titles.",
  };
}

export async function handlePredictionArbitrage(params: {
  minDivergencePp?: number;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const minDivergence = params.minDivergencePp ?? 3;
  const limit = Math.min(params.limit ?? 20, 50);

  const [polyEvents, kalshiEvents] = await Promise.all([
    getTrendingMarkets(50),
    getTrendingEvents(50),
  ]);

  const polyFlat = flattenPoly(polyEvents);
  const kalshiFlat = flattenKalshi(kalshiEvents);

  // Use a lower overlap threshold for arbitrage scanning — cast wider net
  const pairs = buildPairs(polyFlat, kalshiFlat, 15);

  const arb = pairs
    .filter((p) => p.divergencePp >= minDivergence)
    .sort((a, b) => b.divergencePp - a.divergencePp)
    .slice(0, limit);

  return {
    marketsScanned: {
      polymarket: polyFlat.length,
      kalshi: kalshiFlat.length,
    },
    arbOpportunities: arb.length,
    minDivergencePp: minDivergence,
    opportunities: arb.map((pair) => {
      const longExchange = pair.higherOn === "kalshi" ? "polymarket" : "kalshi";
      const shortExchange = pair.higherOn === "kalshi" ? "kalshi" : "polymarket";
      const longProbPct = longExchange === "polymarket" ? pair.polyProbPct : pair.kalshiProbPct;
      const shortProbPct = shortExchange === "polymarket" ? pair.polyProbPct : pair.kalshiProbPct;

      return {
        divergencePp: pair.divergencePp,
        matchConfidence: `${pair.overlapPct}%`,
        action: `Buy YES on ${longExchange} at ${longProbPct}¢/%. Hedge by selling YES (buying NO) on ${shortExchange} at ${shortProbPct}¢/%.`,
        higherOn: pair.higherOn,
        polymarket: {
          question: pair.polymarket.question,
          slug: pair.polymarket.slug,
          probPct: pair.polyProbPct,
          liquidityUSD: pair.polymarket.liquidityUSD,
          spreadBps: pair.polymarket.spreadBps,
        },
        kalshi: {
          question: pair.kalshi.question,
          ticker: pair.kalshi.ticker,
          probPct: pair.kalshiProbPct,
          liquidityUSD: pair.kalshi.liquidityUSD,
          spreadBps: pair.kalshi.spreadBps,
        },
      };
    }),
    timestamp: new Date().toISOString(),
    note: "Arb signals are heuristic — cross-exchange positions require accounts on both Polymarket (USDC/Polygon) and Kalshi (USD/regulated). Prices may converge before orders fill. Verify match confidence before acting.",
  };
}
