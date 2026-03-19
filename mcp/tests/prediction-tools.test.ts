import { describe, it, expect, vi } from "vitest";

vi.mock("../src/data/polymarket.js", () => ({
  getTrendingMarkets: vi.fn().mockResolvedValue([
    {
      id: "e1",
      slug: "test",
      title: "Test Event",
      description: "desc",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      active: true,
      closed: false,
      liquidity: 10000,
      volume: 50000,
      markets: [
        {
          id: "m1",
          question: "Will it happen?",
          conditionId: "0xabc",
          slug: "test-market",
          outcomes: ["Yes", "No"],
          outcomePrices: ["0.65", "0.35"],
          volume: 50000,
          liquidity: 10000,
          active: true,
          closed: false,
          bestBid: 0.64,
          bestAsk: 0.66,
          lastTradePrice: 0.65,
          spread: 0.02,
        },
      ],
    },
  ]),
  searchMarkets: vi.fn().mockResolvedValue([]),
  getOrderBook: vi.fn().mockResolvedValue({
    bids: [{ price: 0.65, size: 1000 }],
    asks: [{ price: 0.67, size: 800 }],
    spread: 0.02,
    midPrice: 0.66,
    bidDepthUSD: 650,
    askDepthUSD: 536,
  }),
}));

import {
  handlePredictionTrending,
  handlePredictionSearch,
  handlePredictionBook,
} from "../src/tools/prediction.js";

describe("Prediction Tool Handlers", () => {
  describe("handlePredictionTrending", () => {
    it("returns formatted events with probabilities", async () => {
      const result = await handlePredictionTrending({ limit: 5 });

      expect(result.source).toBe("Polymarket");
      expect(result.eventCount).toBe(1);

      const events = result.events as Array<{
        title: string;
        markets: Array<{
          outcomes: Array<{ name: string; probability: number }>;
        }>;
      }>;

      expect(events[0].title).toBe("Test Event");
      expect(events[0].markets[0].outcomes[0].name).toBe("Yes");
      expect(events[0].markets[0].outcomes[0].probability).toBe(65);
      expect(events[0].markets[0].outcomes[1].probability).toBe(35);
    });

    it("caps limit at 25", async () => {
      const result = await handlePredictionTrending({ limit: 100 });
      expect(result).toBeDefined();
    });
  });

  describe("handlePredictionSearch", () => {
    it("includes query in response", async () => {
      const result = await handlePredictionSearch({ query: "Bitcoin" });
      expect(result.query).toBe("Bitcoin");
      expect(result.source).toBe("Polymarket");
    });
  });

  describe("handlePredictionBook", () => {
    it("returns order book with spread metrics", async () => {
      const result = await handlePredictionBook({ tokenId: "tok-1" });

      expect(result.midPrice).toBeCloseTo(0.66, 2);
      expect(result.spread).toBeCloseTo(0.02, 2);
      expect(result.bidDepthUSD).toBeGreaterThan(0);
      expect(result.askDepthUSD).toBeGreaterThan(0);
    });
  });
});
