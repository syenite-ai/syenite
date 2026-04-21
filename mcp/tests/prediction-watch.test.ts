import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock polymarket data for the watch creation handler
vi.mock("../src/data/polymarket.js", () => ({
  getMarketDetail: vi.fn().mockResolvedValue({
    id: "m-xyz",
    slug: "election-2026",
    conditionId: "0xcond",
    question: "Will X win?",
    outcomes: ["Yes", "No"],
    outcomePrices: ["0.45", "0.55"],
    clobTokenIds: ["tok-yes", "tok-no"],
    volume: 100_000,
    volume24hr: 10_000,
    liquidity: 50_000,
    active: true,
    closed: false,
    bestBid: 0.44,
    bestAsk: 0.46,
    lastTradePrice: 0.45,
    spread: 0.02,
    endDate: new Date(Date.now() + 48 * 3600_000).toISOString(),
    description: "Resolves per official announcement.",
  }),
  getOrderBook: vi.fn().mockResolvedValue({
    bids: [{ price: 0.44, size: 1000 }],
    asks: [{ price: 0.46, size: 1000 }],
    spread: 0.02,
    midPrice: 0.45,
    bidDepthUSD: 440,
    askDepthUSD: 460,
  }),
  getMarketPriceHistory: vi.fn().mockResolvedValue([]),
  getUserPositions: vi.fn().mockResolvedValue([]),
  getMidpointPrice: vi.fn().mockResolvedValue(0.45),
}));

import { handlePredictionWatch } from "../src/tools/prediction-watch.js";
import {
  addWatch,
  clearAll,
  getAlerts,
  listWatches,
  updateWatchState,
  type PredictionConditions,
} from "../src/data/alerts.js";

async function loadChecker() {
  const mod = await import("../src/data/alert-checker.js");
  return mod;
}

describe("prediction.watch handler", () => {
  it("creates a prediction watch with valid conditions", async () => {
    const result = await handlePredictionWatch({
      slug: "election-2026",
      conditions: { oddsThresholdPct: 70 },
    });
    const w = (result.watch as { id: string; type: string; question?: string });
    expect(w.id).toMatch(/^watch_\d+$/);
    expect(w.type).toBe("prediction");
    expect(w.question).toBe("Will X win?");
  });

  it("rejects when no conditions provided", async () => {
    await expect(handlePredictionWatch({
      slug: "election-2026",
      conditions: {} as PredictionConditions,
    })).rejects.toThrow(/at least one trigger/);
  });

  it("rejects when neither slug nor conditionId provided", async () => {
    await expect(handlePredictionWatch({
      conditions: { oddsThresholdPct: 50 },
    })).rejects.toThrow(/slug or conditionId/);
  });

  it("rejects invalid webhook URL", async () => {
    await expect(handlePredictionWatch({
      slug: "election-2026",
      conditions: { oddsThresholdPct: 50 },
      webhookUrl: "not-a-url",
    })).rejects.toThrow(/http/);
  });

  it("rejects oddsThresholdPct out of range", async () => {
    await expect(handlePredictionWatch({
      slug: "election-2026",
      conditions: { oddsThresholdPct: 150 },
    })).rejects.toThrow(/between 0 and 100/);
  });

  it("rejects zero volumeSpikeMultiple", async () => {
    await expect(handlePredictionWatch({
      slug: "election-2026",
      conditions: { volumeSpikeMultiple: 1 },
    })).rejects.toThrow(/greater than 1/);
  });

  it("stores webhookUrl on the watch", async () => {
    const result = await handlePredictionWatch({
      slug: "election-2026",
      conditions: { oddsThresholdPct: 50 },
      webhookUrl: "https://example.com/hook",
    });
    const w = result.watch as { webhookUrl?: string };
    expect(w.webhookUrl).toBe("https://example.com/hook");
  });
});

describe("alerts storage round-trip", () => {
  it("persists and lists prediction watches", () => {
    const watch = addWatch({
      type: "prediction",
      address: "0xcond",
      slug: "test-slug",
      marketId: "m1",
      conditionId: "0xcond",
      question: "Test?",
      predictionConditions: { oddsThresholdPct: 80 },
      healthFactorThreshold: 0,
    });
    const predictions = listWatches("prediction");
    expect(predictions.some((w) => w.id === watch.id)).toBe(true);
  });
});

describe("alert-checker evaluates prediction watches", () => {
  beforeEach(() => { clearAll(); vi.clearAllMocks(); });

  it("fires odds threshold alert when current odds cross threshold", async () => {
    // Current market midpoint is 0.45 → 45% — threshold 40% triggers.
    const watch = addWatch({
      type: "prediction",
      address: "0xcond",
      slug: "election-2026",
      marketId: "m-xyz",
      conditionId: "0xcond",
      tokenId: "tok-yes",
      question: "Will X win?",
      predictionConditions: { oddsThresholdPct: 40 },
      predictionState: { baselineLiquidity: 50_000, baselineVolume24h: 10_000 },
      healthFactorThreshold: 0,
    });

    const { checkAllWatches } = await loadChecker();
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    expect(alerts.some((a) => a.type === "prediction_odds_threshold")).toBe(true);
  });

  it("fires odds_move alert when movement exceeds delta within window", async () => {
    const watch = addWatch({
      type: "prediction",
      address: "0xcond",
      slug: "election-2026",
      marketId: "m-xyz",
      conditionId: "0xcond",
      tokenId: "tok-yes",
      question: "Will X win?",
      predictionConditions: {
        oddsMovePct: { delta: 5, windowMinutes: 60 },
      },
      predictionState: {
        lastOddsPct: 30,
        lastOddsAt: new Date().toISOString(),
        baselineLiquidity: 50_000,
        baselineVolume24h: 10_000,
      },
      healthFactorThreshold: 0,
    });

    const { checkAllWatches } = await loadChecker();
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    expect(alerts.some((a) => a.type === "prediction_odds_move")).toBe(true);
  });

  it("fires resolution_approaching critical alert when <1h to resolve", async () => {
    const { getMarketDetail } = await import("../src/data/polymarket.js");
    vi.mocked(getMarketDetail).mockResolvedValueOnce({
      id: "m-xyz",
      slug: "election-2026",
      conditionId: "0xcond",
      question: "Will X win?",
      outcomes: ["Yes", "No"],
      outcomePrices: ["0.45", "0.55"],
      clobTokenIds: ["tok-yes", "tok-no"],
      volume: 100_000,
      volume24hr: 10_000,
      liquidity: 50_000,
      active: true,
      closed: false,
      bestBid: 0.44,
      bestAsk: 0.46,
      lastTradePrice: 0.45,
      spread: 0.02,
      endDate: new Date(Date.now() + 30 * 60_000).toISOString(), // 30 minutes
      description: "soon",
    });

    const watch = addWatch({
      type: "prediction",
      address: "0xcond",
      slug: "election-2026",
      marketId: "m-xyz",
      conditionId: "0xcond",
      tokenId: "tok-yes",
      question: "Will X win?",
      predictionConditions: { resolutionApproachingHours: 2 },
      healthFactorThreshold: 0,
    });

    const { checkAllWatches } = await loadChecker();
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    const resAlert = alerts.find((a) => a.type === "prediction_resolution_approaching");
    expect(resAlert).toBeDefined();
    expect(resAlert?.severity).toBe("critical");
  });

  it("updates predictionState baseline after each run", async () => {
    const watch = addWatch({
      type: "prediction",
      address: "0xcond",
      slug: "election-2026",
      marketId: "m-xyz",
      conditionId: "0xcond",
      tokenId: "tok-yes",
      question: "Will X win?",
      predictionConditions: { oddsThresholdPct: 99 },
      healthFactorThreshold: 0,
    });
    updateWatchState(watch.id, { predictionState: {} });

    const { checkAllWatches } = await loadChecker();
    await checkAllWatches();

    const watches = listWatches("prediction");
    const updated = watches.find((w) => w.id === watch.id);
    expect(updated?.predictionState?.lastOddsPct).toBeCloseTo(45, 0);
  });
});
