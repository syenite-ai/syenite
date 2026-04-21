import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProtocolRate, YieldOpportunity } from "../src/data/types.js";

vi.mock("../src/data/db.js", () => ({
  hasDatabase: vi.fn().mockReturnValue(false),
  getPool: vi.fn(),
}));

vi.mock("../src/data/aave.js", () => ({
  getAavePosition: vi.fn().mockResolvedValue([]),
  getSparkPosition: vi.fn().mockResolvedValue([]),
  getAaveRates: vi.fn().mockResolvedValue([]),
  getSparkRates: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/data/morpho.js", () => ({
  getMorphoPosition: vi.fn().mockResolvedValue([]),
  getMorphoRatesMultiChain: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/data/compound.js", () => ({
  getCompoundPosition: vi.fn().mockResolvedValue([]),
  getCompoundRates: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/data/fluid.js", () => ({
  getFluidRates: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/data/yield-lending.js", () => ({
  getLendingSupplyYields: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/data/yield-staking.js", () => ({
  getStakingYields: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/data/yield-vaults.js", () => ({
  getVaultYields: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/data/yield-metamorpho.js", () => ({
  getMetaMorphoYields: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/data/solana/yield.js", () => ({
  getSolanaYields: vi.fn().mockResolvedValue([]),
}));
vi.mock("../src/data/polymarket.js", () => ({
  getMarketDetail: vi.fn().mockResolvedValue(null),
  getOrderBook: vi.fn().mockResolvedValue(null),
}));
vi.mock("../src/data/webhook.js", () => ({
  deliverWebhook: vi.fn().mockResolvedValue(undefined),
}));

import { addWatch, clearAll, getAlerts } from "../src/data/alerts.js";
import { getAaveRates } from "../src/data/aave.js";
import { getStakingYields } from "../src/data/yield-staking.js";

async function loadChecker() {
  const mod = await import("../src/data/alert-checker.js");
  return mod.checkAllWatches;
}

function makeRate(overrides: Partial<ProtocolRate> = {}): ProtocolRate {
  return {
    protocol: "aave",
    chain: "ethereum",
    market: "WBTC/USDC",
    collateral: "WBTC",
    borrowAPY: 5.0,
    supplyAPY: 3.0,
    utilization: 80.0,
    availableLiquidityUSD: 1_000_000,
    maxLTV: 70,
    liquidationThreshold: 75,
    liquidationPenalty: 5,
    ...overrides,
  };
}

function makeYield(overrides: Partial<YieldOpportunity> = {}): YieldOpportunity {
  return {
    protocol: "aave",
    product: "USDC supply",
    asset: "USDC",
    apy: 5.0,
    apyType: "variable",
    tvlUSD: 10_000_000,
    category: "lending-supply",
    risk: "low",
    riskNotes: "well-audited",
    lockup: "none",
    ...overrides,
  };
}

describe("checkRateWatch — edge detection", () => {
  beforeEach(() => {
    clearAll();
    vi.mocked(getAaveRates).mockResolvedValue([]);
  });

  it("fires rate_spike when borrow APY crosses above threshold for the first time", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "rate",
      address: "n/a",
      healthFactorThreshold: 0,
      rateBorrowThreshold: 6,
      rateDirection: "above",
    });

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 7.0 })]);
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("rate_spike");
    expect(alerts[0].severity).toBe("warning");
  });

  it("does not re-fire while borrow APY stays above threshold", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "rate",
      address: "n/a",
      healthFactorThreshold: 0,
      rateBorrowThreshold: 6,
      rateDirection: "above",
    });

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 7.0 })]);
    await checkAllWatches();
    await checkAllWatches();

    expect(getAlerts(watch.id)).toHaveLength(1);
  });

  it("re-fires after borrow APY drops below then crosses above threshold again", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "rate",
      address: "n/a",
      healthFactorThreshold: 0,
      rateBorrowThreshold: 6,
      rateDirection: "above",
    });

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 7.0 })]);
    await checkAllWatches(); // fires

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 5.0 })]);
    await checkAllWatches(); // drops below — no new alert

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 7.0 })]);
    await checkAllWatches(); // crosses above again — fires

    expect(getAlerts(watch.id)).toHaveLength(2);
  });

  it("does not fire when borrow APY is below threshold with direction above", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "rate",
      address: "n/a",
      healthFactorThreshold: 0,
      rateBorrowThreshold: 6,
      rateDirection: "above",
    });

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 5.0 })]);
    await checkAllWatches();

    expect(getAlerts(watch.id)).toHaveLength(0);
  });

  it("fires rate_utilization at warning severity when utilization crosses threshold below 95%", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "rate",
      address: "n/a",
      healthFactorThreshold: 0,
      rateUtilizationThreshold: 80,
    });

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ utilization: 85 })]);
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("rate_utilization");
    expect(alerts[0].severity).toBe("warning");
  });

  it("fires rate_utilization at critical severity when utilization reaches 95% or above", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "rate",
      address: "n/a",
      healthFactorThreshold: 0,
      rateUtilizationThreshold: 80,
    });

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ utilization: 96 })]);
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    expect(alerts[0].severity).toBe("critical");
  });

  it("tracks each market independently — markets can cross threshold at different times", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "rate",
      address: "n/a",
      healthFactorThreshold: 0,
      rateBorrowThreshold: 6,
      rateDirection: "above",
    });

    // Only WBTC/USDC crosses — ETH/USDC does not
    vi.mocked(getAaveRates).mockResolvedValue([
      makeRate({ market: "WBTC/USDC", borrowAPY: 7.0 }),
      makeRate({ market: "ETH/USDC", borrowAPY: 4.0 }),
    ]);
    await checkAllWatches();

    expect(getAlerts(watch.id)).toHaveLength(1);

    // Now ETH/USDC crosses — WBTC/USDC was already above, no re-fire
    vi.mocked(getAaveRates).mockResolvedValue([
      makeRate({ market: "WBTC/USDC", borrowAPY: 7.0 }),
      makeRate({ market: "ETH/USDC", borrowAPY: 7.0 }),
    ]);
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    expect(alerts).toHaveLength(2);
    const markets = alerts.map((a) => (a.data as Record<string, unknown>).market);
    expect(markets).toContain("WBTC/USDC");
    expect(markets).toContain("ETH/USDC");
  });
});

describe("checkCarryWatch — edge detection", () => {
  beforeEach(() => {
    clearAll();
    vi.mocked(getAaveRates).mockResolvedValue([]);
    vi.mocked(getStakingYields).mockResolvedValue([]);
  });

  it("fires carry_opportunity when spread first exceeds threshold", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "carry",
      address: "n/a",
      healthFactorThreshold: 0,
      carryBorrowAsset: "USDC",
      carrySupplyAsset: "USDC",
      carryThreshold: 2,
    });

    // supply APY 6%, borrow APY 3% → spread 3%
    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 3.0 })]);
    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 6.0, asset: "USDC" })]);
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("carry_opportunity");
    expect((alerts[0].data as Record<string, unknown>).spread).toBeCloseTo(3.0);
  });

  it("does not re-fire while spread remains above threshold", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "carry",
      address: "n/a",
      healthFactorThreshold: 0,
      carryBorrowAsset: "USDC",
      carrySupplyAsset: "USDC",
      carryThreshold: 2,
    });

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 3.0 })]);
    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 6.0, asset: "USDC" })]);
    await checkAllWatches();
    await checkAllWatches();

    expect(getAlerts(watch.id)).toHaveLength(1);
  });

  it("does not fire when spread is below threshold", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "carry",
      address: "n/a",
      healthFactorThreshold: 0,
      carryThreshold: 5,
    });

    // spread = 5 - 4 = 1%, below threshold 5%
    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 4.0 })]);
    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 5.0, asset: "USDC" })]);
    await checkAllWatches();

    expect(getAlerts(watch.id)).toHaveLength(0);
  });

  it("re-fires after spread drops below then rises above threshold again", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "carry",
      address: "n/a",
      healthFactorThreshold: 0,
      carryBorrowAsset: "USDC",
      carrySupplyAsset: "USDC",
      carryThreshold: 2,
    });

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 3.0 })]);
    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 6.0, asset: "USDC" })]);
    await checkAllWatches(); // fires (spread 3%)

    // spread drops to 1%
    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 4.5 })]);
    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 5.5, asset: "USDC" })]);
    await checkAllWatches(); // no alert

    vi.mocked(getAaveRates).mockResolvedValue([makeRate({ borrowAPY: 3.0 })]);
    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 6.0, asset: "USDC" })]);
    await checkAllWatches(); // re-fires

    expect(getAlerts(watch.id)).toHaveLength(2);
  });
});

describe("checkYieldWatch — edge detection", () => {
  beforeEach(() => {
    clearAll();
    vi.mocked(getStakingYields).mockResolvedValue([]);
  });

  it("fires yield_opportunity when best APY first crosses above threshold", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "yield",
      address: "n/a",
      healthFactorThreshold: 0,
      yieldAsset: "USDC",
      yieldApyThreshold: 5,
      yieldDirection: "above",
    });

    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 6.0, asset: "USDC" })]);
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("yield_opportunity");
  });

  it("does not re-fire while APY stays above threshold", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "yield",
      address: "n/a",
      healthFactorThreshold: 0,
      yieldAsset: "USDC",
      yieldApyThreshold: 5,
      yieldDirection: "above",
    });

    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 6.0, asset: "USDC" })]);
    await checkAllWatches();
    await checkAllWatches();

    expect(getAlerts(watch.id)).toHaveLength(1);
  });

  it("re-fires after APY drops below then rises above threshold again", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "yield",
      address: "n/a",
      healthFactorThreshold: 0,
      yieldAsset: "USDC",
      yieldApyThreshold: 5,
      yieldDirection: "above",
    });

    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 6.0, asset: "USDC" })]);
    await checkAllWatches(); // fires

    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 4.0, asset: "USDC" })]);
    await checkAllWatches(); // drops below — no alert

    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 6.0, asset: "USDC" })]);
    await checkAllWatches(); // back above — fires again

    expect(getAlerts(watch.id)).toHaveLength(2);
  });

  it("fires yield_opportunity when APY drops below threshold with direction below", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "yield",
      address: "n/a",
      healthFactorThreshold: 0,
      yieldAsset: "USDC",
      yieldApyThreshold: 5,
      yieldDirection: "below",
    });

    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 4.0, asset: "USDC" })]);
    await checkAllWatches();

    const alerts = getAlerts(watch.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("yield_opportunity");
  });

  it("does not fire when APY is above threshold with direction below", async () => {
    const checkAllWatches = await loadChecker();
    const watch = await addWatch({
      type: "yield",
      address: "n/a",
      healthFactorThreshold: 0,
      yieldAsset: "USDC",
      yieldApyThreshold: 5,
      yieldDirection: "below",
    });

    vi.mocked(getStakingYields).mockResolvedValue([makeYield({ apy: 6.0, asset: "USDC" })]);
    await checkAllWatches();

    expect(getAlerts(watch.id)).toHaveLength(0);
  });
});
