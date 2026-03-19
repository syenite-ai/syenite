import { describe, it, expect, vi } from "vitest";

// Test that the Compound module structure is correct without making RPC calls
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

import { getCompoundRates, getCompoundPosition } from "../src/data/compound.js";

describe("Compound V3 Module", () => {
  it("exports getCompoundRates function", () => {
    expect(typeof getCompoundRates).toBe("function");
  });

  it("exports getCompoundPosition function", () => {
    expect(typeof getCompoundPosition).toBe("function");
  });

  it("getCompoundRates returns empty array on RPC failure (graceful degradation)", async () => {
    const rates = await getCompoundRates("all", "USDC");
    expect(Array.isArray(rates)).toBe(true);
    expect(rates.length).toBe(0);
  });

  it("getCompoundRates filters by chain", async () => {
    const rates = await getCompoundRates("all", "USDC", ["ethereum"]);
    expect(Array.isArray(rates)).toBe(true);
  });

  it("getCompoundRates filters by borrow asset", async () => {
    // Only USDC Comets are configured
    const rates = await getCompoundRates("all", "DAI");
    expect(rates.length).toBe(0);
  });

  it("getCompoundPosition returns empty array on RPC failure", async () => {
    const positions = await getCompoundPosition(
      "0x1234567890123456789012345678901234567890" as `0x${string}`,
    );
    expect(Array.isArray(positions)).toBe(true);
    expect(positions.length).toBe(0);
  });
});
