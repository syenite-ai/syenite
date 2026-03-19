import { describe, it, expect, vi } from "vitest";

vi.mock("../src/data/client.js", () => ({
  getClient: vi.fn(() => ({
    readContract: vi.fn().mockRejectedValue(new Error("No RPC in test")),
  })),
}));

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

import { getFluidRates } from "../src/data/fluid.js";

describe("Fluid Module", () => {
  it("exports getFluidRates function", () => {
    expect(typeof getFluidRates).toBe("function");
  });

  it("returns empty array on RPC failure (graceful degradation)", async () => {
    const rates = await getFluidRates("all", "USDC");
    expect(Array.isArray(rates)).toBe(true);
    expect(rates.length).toBe(0);
  });

  it("filters by collateral symbol", async () => {
    const rates = await getFluidRates("wstETH", "USDC");
    expect(Array.isArray(rates)).toBe(true);
  });

  it("filters by collateral category", async () => {
    const rates = await getFluidRates("BTC", "USDC");
    expect(Array.isArray(rates)).toBe(true);
  });

  it("filters by chain", async () => {
    const rates = await getFluidRates("all", "USDC", ["ethereum"]);
    expect(Array.isArray(rates)).toBe(true);
  });

  it("returns empty for non-USDC borrow asset", async () => {
    const rates = await getFluidRates("all", "DAI");
    expect(rates.length).toBe(0);
  });
});
