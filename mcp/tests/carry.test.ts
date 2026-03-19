import { describe, it, expect, vi } from "vitest";

vi.mock("../src/data/aave.js", () => ({
  getAaveRates: vi.fn().mockResolvedValue([
    {
      protocol: "aave-v3",
      chain: "ethereum",
      market: "Aave v3 wstETH/USDC",
      collateral: "wstETH",
      borrowAsset: "USDC",
      supplyAPY: 4.5,
      borrowAssetSupplyAPY: 2.0,
      borrowAPY: 3.0,
      availableLiquidity: 500000,
      availableLiquidityUSD: 500000,
      totalSupply: 1000000,
      totalBorrow: 500000,
      utilization: 50,
      maxLTV: 80,
      liquidationThreshold: 82.5,
      liquidationPenalty: 5,
      lastUpdated: new Date().toISOString(),
    },
  ]),
  getSparkRates: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/data/morpho.js", () => ({
  getMorphoRates: vi.fn().mockResolvedValue([
    {
      protocol: "morpho-blue",
      chain: "ethereum",
      market: "Morpho wBTC/USDC",
      collateral: "wBTC",
      borrowAsset: "USDC",
      supplyAPY: 2.0,
      borrowAssetSupplyAPY: 2.0,
      borrowAPY: 5.0,
      availableLiquidity: 200000,
      availableLiquidityUSD: 200000,
      totalSupply: 400000,
      totalBorrow: 200000,
      utilization: 50,
      maxLTV: 86,
      liquidationThreshold: 86,
      liquidationPenalty: 5,
      lastUpdated: new Date().toISOString(),
    },
  ]),
}));

vi.mock("../src/data/compound.js", () => ({
  getCompoundRates: vi.fn().mockResolvedValue([
    {
      protocol: "compound-v3",
      chain: "arbitrum",
      market: "Compound V3 (arbitrum) WETH/USDC",
      collateral: "WETH",
      borrowAsset: "USDC",
      supplyAPY: 3.2,
      borrowAssetSupplyAPY: 2.5,
      borrowAPY: 3.1,
      availableLiquidity: 300000,
      availableLiquidityUSD: 300000,
      totalSupply: 600000,
      totalBorrow: 300000,
      utilization: 50,
      maxLTV: 75,
      liquidationThreshold: 80,
      liquidationPenalty: 8,
      lastUpdated: new Date().toISOString(),
    },
  ]),
}));

vi.mock("../src/data/fluid.js", () => ({
  getFluidRates: vi.fn().mockResolvedValue([]),
}));

import { handleCarryScreener } from "../src/tools/carry.js";

describe("Carry Screener", () => {
  it("returns strategies ranked by net carry", async () => {
    const result = await handleCarryScreener({});

    const strategies = result.strategies as Array<{ netCarry: number; market: string }>;

    expect(strategies.length).toBe(3);
    // wstETH has net carry of 1.5% (4.5 - 3.0) — highest
    expect(strategies[0].netCarry).toBe(1.5);
    expect(strategies[0].market).toContain("wstETH");
  });

  it("calculates leveraged carry correctly", async () => {
    const result = await handleCarryScreener({});
    const strategies = result.strategies as Array<{ netCarry: number; leveragedCarry: number; maxLTV: number }>;

    const wstETH = strategies.find((s) => s.netCarry === 1.5)!;
    // Safe LTV = 80 * 0.7 / 100 = 0.56, leverage = 1 / (1 - 0.56) ≈ 2.2727
    // Leveraged carry = 1.5 * 2.2727 ≈ 3.41
    expect(wstETH.leveragedCarry).toBeCloseTo(3.41, 1);
  });

  it("reports correct summary stats", async () => {
    const result = await handleCarryScreener({});
    const summary = result.summary as {
      totalMarketsScanned: number;
      positiveCarryCount: number;
      bestCarry: { netCarry: number } | null;
    };

    expect(summary.totalMarketsScanned).toBe(3);
    expect(summary.positiveCarryCount).toBe(2); // wstETH (1.5) and WETH (0.1)
    expect(summary.bestCarry?.netCarry).toBe(1.5);
  });

  it("filters by minCarry threshold", async () => {
    const result = await handleCarryScreener({ minCarry: 1.0 });
    const strategies = result.strategies as Array<{ netCarry: number }>;

    expect(strategies.length).toBe(1);
    expect(strategies[0].netCarry).toBe(1.5);
  });

  it("calculates estimated annual return for position size", async () => {
    const result = await handleCarryScreener({ positionSizeUSD: 200000 });
    const strategies = result.strategies as Array<{
      netCarry: number;
      estimatedAnnualReturnUSD: number;
    }>;

    const best = strategies[0];
    // 200,000 * 1.5% = 3000
    expect(best.estimatedAnnualReturnUSD).toBe(3000);
  });

  it("includes chain in query response", async () => {
    const result = await handleCarryScreener({ chain: "ethereum" });
    const query = result.query as { chain: string };
    expect(query.chain).toBe("ethereum");
  });

  it("has a note explaining methodology", async () => {
    const result = await handleCarryScreener({});
    expect(result.note).toContain("Net carry");
    expect(result.note).toContain("supply APY");
  });
});
