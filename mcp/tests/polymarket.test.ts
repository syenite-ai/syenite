import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/data/cache.js", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/logging/logger.js", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../src/logging/metrics.js", () => ({
  recordCacheHit: vi.fn(),
  recordCacheMiss: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { getTrendingMarkets, searchMarkets, getOrderBook } from "../src/data/polymarket.js";

describe("Polymarket Data Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTrendingMarkets", () => {
    it("parses Gamma API response correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          {
            id: "evt-1",
            slug: "test-event",
            title: "Will BTC hit 100k?",
            description: "Test event",
            start_date: "2025-01-01",
            end_date: "2025-12-31",
            active: true,
            closed: false,
            liquidity: 50000,
            volume: 250000,
            markets: [
              {
                id: "mkt-1",
                question: "Will BTC hit 100k by EOY?",
                condition_id: "0xabc",
                slug: "btc-100k",
                outcomes: '["Yes","No"]',
                outcome_prices: '["0.72","0.28"]',
                volume: "250000",
                liquidity: "50000",
                active: true,
                closed: false,
                best_bid: 0.71,
                best_ask: 0.73,
                last_trade_price: 0.72,
                spread: 0.02,
              },
            ],
          },
        ]),
      });

      const events = await getTrendingMarkets(5);

      expect(events).toHaveLength(1);
      expect(events[0].title).toBe("Will BTC hit 100k?");
      expect(events[0].volume).toBe(250000);
      expect(events[0].markets).toHaveLength(1);

      const market = events[0].markets[0];
      expect(market.outcomes).toEqual(["Yes", "No"]);
      expect(market.outcomePrices).toEqual(["0.72", "0.28"]);
      expect(market.bestBid).toBe(0.71);
      expect(market.bestAsk).toBe(0.73);
      expect(market.spread).toBe(0.02);
    });

    it("returns empty array on API failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const events = await getTrendingMarkets();
      expect(events).toEqual([]);
    });

    it("returns empty array on non-200 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const events = await getTrendingMarkets();
      expect(events).toEqual([]);
    });
  });

  describe("searchMarkets", () => {
    it("encodes query parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await searchMarkets("BTC price target");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("BTC%20price%20target"),
        expect.any(Object)
      );
    });

    it("returns empty array on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("timeout"));
      const result = await searchMarkets("test");
      expect(result).toEqual([]);
    });
  });

  describe("getOrderBook", () => {
    it("parses CLOB order book response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          bids: [
            { price: "0.65", size: "1000" },
            { price: "0.64", size: "500" },
          ],
          asks: [
            { price: "0.67", size: "800" },
            { price: "0.68", size: "1200" },
          ],
        }),
      });

      const book = await getOrderBook("token-123");
      expect(book).not.toBeNull();
      expect(book!.bids).toHaveLength(2);
      expect(book!.asks).toHaveLength(2);
      expect(book!.spread).toBeCloseTo(0.02);
      expect(book!.midPrice).toBeCloseTo(0.66);
      expect(book!.bidDepthUSD).toBeGreaterThan(0);
      expect(book!.askDepthUSD).toBeGreaterThan(0);
    });

    it("returns null on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("timeout"));
      const book = await getOrderBook("bad-token");
      expect(book).toBeNull();
    });
  });
});
