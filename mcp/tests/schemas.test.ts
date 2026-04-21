import { describe, it, expect } from "vitest";
import {
  helpOutput,
  ratesOutput,
  marketOverviewOutput,
  positionMonitorOutput,
  riskAssessOutput,
  yieldOpportunitiesOutput,
  yieldAssessOutput,
  swapQuoteOutput,
  swapStatusOutput,
  predictionTrendingOutput,
  predictionSearchOutput,
  predictionBookOutput,
  carryScreenerOutput,
  alertWatchOutput,
  alertCheckOutput,
  alertListOutput,
  alertRemoveOutput,
} from "../src/schemas.js";

describe("Zod Output Schemas", () => {
  const schemas = {
    helpOutput,
    ratesOutput,
    marketOverviewOutput,
    positionMonitorOutput,
    riskAssessOutput,
    yieldOpportunitiesOutput,
    yieldAssessOutput,
    swapQuoteOutput,
    swapStatusOutput,
    predictionTrendingOutput,
    predictionSearchOutput,
    predictionBookOutput,
    carryScreenerOutput,
    alertWatchOutput,
    alertCheckOutput,
    alertListOutput,
    alertRemoveOutput,
  };

  it("exports all 17 output schemas", () => {
    expect(Object.keys(schemas).length).toBe(17);
    for (const [name, schema] of Object.entries(schemas)) {
      expect(schema, `${name} should be defined`).toBeDefined();
      expect(typeof schema.parse, `${name} should have a parse method`).toBe("function");
    }
  });

  it("ratesOutput validates a well-formed response", () => {
    const valid = {
      query: { collateral: "all", borrowAsset: "USDC", chain: "all" },
      bestBorrowRate: { protocol: "aave-v3", chain: "ethereum", market: "Aave v3 wBTC/USDC", borrowAPY: 3.5 },
      markets: [{
        protocol: "aave-v3",
        chain: "ethereum",
        market: "Aave v3 wBTC/USDC",
        collateral: "wBTC",
        borrowAPY: 3.5,
        supplyAPY: 0.1,
        availableLiquidityUSD: 1000000,
        utilization: 45,
        maxLTV: 70,
        liquidationThreshold: 75,
        liquidationPenalty: 5,
      }],
      timestamp: new Date().toISOString(),
      note: "test",
    };

    expect(() => ratesOutput.parse(valid)).not.toThrow();
  });

  it("ratesOutput rejects missing chain field", () => {
    const invalid = {
      query: { collateral: "all", borrowAsset: "USDC", chain: "all" },
      bestBorrowRate: null,
      markets: [{
        protocol: "aave-v3",
        // missing chain
        market: "test",
        collateral: "wBTC",
        borrowAPY: 3,
        supplyAPY: 0,
        availableLiquidityUSD: 0,
        utilization: 0,
        maxLTV: 70,
        liquidationThreshold: 75,
        liquidationPenalty: 5,
      }],
      timestamp: new Date().toISOString(),
      note: "test",
    };

    expect(() => ratesOutput.parse(invalid)).toThrow();
  });

  it("predictionTrendingOutput validates well-formed response", () => {
    const valid = {
      source: "Polymarket",
      eventCount: 1,
      events: [{
        id: "123",
        title: "Test Event",
        slug: "test-event",
        active: true,
        volume: 50000,
        liquidity: 10000,
        markets: [{
          id: "m1",
          question: "Will X happen?",
          conditionId: "0xabc",
          outcomes: [
            { name: "Yes", probability: 65 },
            { name: "No", probability: 35 },
          ],
          volume: 50000,
          liquidity: 10000,
          bestBid: 0.64,
          bestAsk: 0.66,
          spread: 0.02,
          lastTradePrice: 0.65,
        }],
      }],
      timestamp: new Date().toISOString(),
      note: "test",
    };

    expect(() => predictionTrendingOutput.parse(valid)).not.toThrow();
  });

  it("carryScreenerOutput validates well-formed response", () => {
    const valid = {
      query: {
        collateral: "all",
        borrowAsset: "USDC",
        chain: "all",
        positionSizeUSD: 100000,
      },
      summary: {
        totalMarketsScanned: 5,
        positiveCarryCount: 2,
        bestCarry: {
          market: "Aave v3 wstETH/USDC",
          netCarry: 1.5,
          leveragedCarry: 3.2,
          estimatedAnnualReturnUSD: 1500,
        },
      },
      strategies: [{
        protocol: "aave-v3",
        chain: "ethereum",
        market: "Aave v3 wstETH/USDC",
        collateral: "wstETH",
        borrowAsset: "USDC",
        supplyAPY: 4.5,
        borrowAPY: 3.0,
        netCarry: 1.5,
        maxLTV: 80,
        leveragedCarry: 3.2,
        liquidationPenalty: 5,
        availableLiquidityUSD: 500000,
        utilization: 60,
        estimatedAnnualReturnUSD: 1500,
      }],
      timestamp: new Date().toISOString(),
      note: "test",
    };

    expect(() => carryScreenerOutput.parse(valid)).not.toThrow();
  });

  it("alertWatchOutput validates well-formed response", () => {
    const valid = {
      watch: {
        id: "watch_1",
        type: "lending" as const,
        address: "0x123",
        healthFactorThreshold: 1.5,
        createdAt: new Date().toISOString(),
      },
      message: "Now watching...",
      usage: "Poll alerts.check...",
    };

    expect(() => alertWatchOutput.parse(valid)).not.toThrow();
  });

  it("alertCheckOutput validates well-formed response", () => {
    const valid = {
      alertCount: 1,
      critical: 0,
      warnings: 1,
      alerts: [{
        watchId: "watch_1",
        type: "health_factor_low",
        severity: "warning" as const,
        message: "HF at 1.3",
        data: { healthFactor: 1.3 },
        createdAt: new Date().toISOString(),
      }],
      timestamp: new Date().toISOString(),
    };

    expect(() => alertCheckOutput.parse(valid)).not.toThrow();
  });
});
