import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../src/data/db.js", () => ({
  hasDatabase: () => false,
  getPool: () => { throw new Error("No DB"); },
}));

vi.mock("../src/logging/metrics.js", () => ({
  recordCacheHit: vi.fn(),
  recordCacheMiss: vi.fn(),
  recordToolCall: vi.fn(),
}));

const fetchMock = vi.fn();

beforeEach(async () => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  const { clearCache } = await import("../src/data/cache.js");
  clearCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function gqlResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data }),
  };
}

describe("Morpho GraphQL rates (multi-chain)", () => {
  it("parses markets on Base", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        markets: {
          items: [
            {
              uniqueKey: "0xabc",
              loanAsset: { symbol: "USDC", decimals: 6 },
              collateralAsset: { symbol: "cbBTC" },
              state: {
                supplyApy: 0.0451,
                borrowApy: 0.0678,
                supplyAssetsUsd: 12_000_000,
                borrowAssetsUsd: 8_000_000,
                liquidityAssetsUsd: 4_000_000,
                utilization: 0.6667,
                fee: 0,
              },
              lltv: "860000000000000000",
            },
          ],
        },
      })
    );

    const { getMorphoRatesViaGraphQL } = await import("../src/data/morpho.js");
    const rates = await getMorphoRatesViaGraphQL("base", "all", "USDC");

    expect(rates).toHaveLength(1);
    expect(rates[0].chain).toBe("base");
    expect(rates[0].protocol).toBe("morpho-blue");
    expect(rates[0].collateral).toBe("cbBTC");
    expect(rates[0].supplyAPY).toBeCloseTo(4.51, 2);
    expect(rates[0].borrowAPY).toBeCloseTo(6.78, 2);
    expect(rates[0].maxLTV).toBeCloseTo(86, 1);
    expect(rates[0].availableLiquidityUSD).toBe(4_000_000);
  });

  it("filters by collateral category (BTC)", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        markets: {
          items: [
            {
              uniqueKey: "0xbtc",
              loanAsset: { symbol: "USDC", decimals: 6 },
              collateralAsset: { symbol: "cbBTC" },
              state: {
                supplyApy: 0.03, borrowApy: 0.05,
                supplyAssetsUsd: 1, borrowAssetsUsd: 0,
                liquidityAssetsUsd: 1, utilization: 0, fee: 0,
              },
              lltv: "860000000000000000",
            },
            {
              uniqueKey: "0xeth",
              loanAsset: { symbol: "USDC", decimals: 6 },
              collateralAsset: { symbol: "WETH" },
              state: {
                supplyApy: 0.01, borrowApy: 0.02,
                supplyAssetsUsd: 1, borrowAssetsUsd: 0,
                liquidityAssetsUsd: 1, utilization: 0, fee: 0,
              },
              lltv: "860000000000000000",
            },
          ],
        },
      })
    );

    const { getMorphoRatesViaGraphQL } = await import("../src/data/morpho.js");
    const rates = await getMorphoRatesViaGraphQL("base", "BTC", "USDC");

    expect(rates).toHaveLength(1);
    expect(rates[0].collateral).toBe("cbBTC");
  });

  it("returns [] on non-ok response (never throws)", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const { getMorphoRatesViaGraphQL } = await import("../src/data/morpho.js");
    const rates = await getMorphoRatesViaGraphQL("base", "all", "USDC");
    expect(rates).toEqual([]);
  });

  it("returns [] for unknown chain without hitting network", async () => {
    const { getMorphoRatesViaGraphQL } = await import("../src/data/morpho.js");
    const rates = await getMorphoRatesViaGraphQL("solana", "all", "USDC");
    expect(rates).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("MetaMorpho vault discovery", () => {
  it("parses vaults with curator and top markets", async () => {
    fetchMock.mockResolvedValueOnce(
      gqlResponse({
        vaults: {
          items: [
            {
              address: "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
              name: "Steakhouse USDC",
              asset: { symbol: "USDC" },
              metadata: { curators: [{ name: "Steakhouse Financial" }] },
              state: {
                netApy: 0.0723,
                totalAssetsUsd: 150_000_000,
                fee: 0.05,
                allocation: [
                  {
                    market: { uniqueKey: "0xA", collateralAsset: { symbol: "wstETH" } },
                    supplyAssetsUsd: 60_000_000,
                  },
                  {
                    market: { uniqueKey: "0xB", collateralAsset: { symbol: "cbBTC" } },
                    supplyAssetsUsd: 40_000_000,
                  },
                  {
                    market: null,
                    supplyAssetsUsd: 50_000_000,
                  },
                ],
              },
            },
          ],
        },
      })
    );

    const { getMetaMorphoVaults } = await import("../src/data/morpho.js");
    const vaults = await getMetaMorphoVaults("ethereum");

    expect(vaults).toHaveLength(1);
    const v = vaults[0];
    expect(v.name).toBe("Steakhouse USDC");
    expect(v.curator).toBe("Steakhouse Financial");
    expect(v.asset).toBe("USDC");
    expect(v.chain).toBe("ethereum");
    expect(v.netAPY).toBeCloseTo(7.23, 2);
    expect(v.tvlUSD).toBe(150_000_000);
    expect(v.feeBps).toBe(500);
    expect(v.marketCount).toBe(2);
    expect(v.topMarkets).toHaveLength(2);
    expect(v.topMarkets[0].collateral).toBe("wstETH");
    expect(v.topMarkets[0].allocation).toBeCloseTo(0.4, 2);
  });

  it("returns [] for unknown chain without hitting network", async () => {
    const { getMetaMorphoVaults } = await import("../src/data/morpho.js");
    const vaults = await getMetaMorphoVaults("solana");
    expect(vaults).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns [] on GraphQL errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: "bad" }] }),
    });
    const { getMetaMorphoVaults } = await import("../src/data/morpho.js");
    const vaults = await getMetaMorphoVaults("ethereum");
    expect(vaults).toEqual([]);
  });
});

describe("MORPHO_BLUE_BY_CHAIN", () => {
  it("has entries for the four Morpho chains", async () => {
    const { MORPHO_BLUE_BY_CHAIN } = await import("../src/data/types.js");
    expect(MORPHO_BLUE_BY_CHAIN.ethereum).toBeDefined();
    expect(MORPHO_BLUE_BY_CHAIN.base).toBeDefined();
    expect(MORPHO_BLUE_BY_CHAIN.arbitrum).toBeDefined();
    expect(MORPHO_BLUE_BY_CHAIN.optimism).toBeDefined();
  });
});
