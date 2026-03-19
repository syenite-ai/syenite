import { describe, it, expect } from "vitest";
import {
  AAVE_V3,
  AAVE_V3_ARBITRUM,
  AAVE_V3_BASE,
  SPARK,
  MORPHO,
  TOKENS,
  TOKENS_ARBITRUM,
  TOKENS_BASE,
  TOKEN_DECIMALS,
  TOKEN_DECIMALS_ARBITRUM,
  TOKEN_DECIMALS_BASE,
  COLLATERAL_ASSETS,
  COLLATERAL_ASSETS_ARBITRUM,
  COLLATERAL_ASSETS_BASE,
  CHAINLINK_FEEDS,
  TOKEN_PRICE_FEED,
  CACHE_TTL,
  MORPHO_MARKETS,
} from "../src/data/types.js";

describe("Type definitions and constants", () => {
  describe("Contract addresses", () => {
    it("Aave V3 mainnet addresses are valid checksummed", () => {
      expect(AAVE_V3.pool).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(AAVE_V3.poolDataProvider).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("Aave V3 Arbitrum addresses are valid", () => {
      expect(AAVE_V3_ARBITRUM.pool).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(AAVE_V3_ARBITRUM.poolDataProvider).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("Aave V3 Base addresses are valid", () => {
      expect(AAVE_V3_BASE.pool).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(AAVE_V3_BASE.poolDataProvider).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("Spark addresses are valid", () => {
      expect(SPARK.pool).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("Morpho addresses are valid", () => {
      expect(MORPHO.blue).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });

  describe("Token registries", () => {
    it("mainnet TOKENS covers BTC, ETH, and stablecoins", () => {
      expect(TOKENS.wBTC).toBeDefined();
      expect(TOKENS.tBTC).toBeDefined();
      expect(TOKENS.cbBTC).toBeDefined();
      expect(TOKENS.WETH).toBeDefined();
      expect(TOKENS.wstETH).toBeDefined();
      expect(TOKENS.USDC).toBeDefined();
    });

    it("Arbitrum TOKENS has USDC and WETH", () => {
      expect(TOKENS_ARBITRUM.USDC).toBeDefined();
      expect(TOKENS_ARBITRUM.WETH).toBeDefined();
      expect(TOKENS_ARBITRUM.WBTC).toBeDefined();
    });

    it("Base TOKENS has USDC and cbBTC", () => {
      expect(TOKENS_BASE.USDC).toBeDefined();
      expect(TOKENS_BASE.cbBTC).toBeDefined();
      expect(TOKENS_BASE.WETH).toBeDefined();
    });

    it("all addresses are 42-char hex strings", () => {
      for (const [, addr] of Object.entries(TOKENS)) {
        expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
      for (const [, addr] of Object.entries(TOKENS_ARBITRUM)) {
        expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
      for (const [, addr] of Object.entries(TOKENS_BASE)) {
        expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    });
  });

  describe("Token decimals", () => {
    it("USDC is 6 decimals on all chains", () => {
      expect(TOKEN_DECIMALS.USDC).toBe(6);
      expect(TOKEN_DECIMALS_ARBITRUM.USDC).toBe(6);
      expect(TOKEN_DECIMALS_BASE.USDC).toBe(6);
    });

    it("WETH is 18 decimals on all chains", () => {
      expect(TOKEN_DECIMALS.WETH).toBe(18);
      expect(TOKEN_DECIMALS_ARBITRUM.WETH).toBe(18);
      expect(TOKEN_DECIMALS_BASE.WETH).toBe(18);
    });

    it("wBTC/WBTC is 8 decimals", () => {
      expect(TOKEN_DECIMALS.wBTC).toBe(8);
      expect(TOKEN_DECIMALS_ARBITRUM.WBTC).toBe(8);
    });
  });

  describe("Collateral assets", () => {
    it("mainnet has BTC and ETH categories", () => {
      const btc = COLLATERAL_ASSETS.filter((a) => a.category === "BTC");
      const eth = COLLATERAL_ASSETS.filter((a) => a.category === "ETH");
      expect(btc.length).toBeGreaterThanOrEqual(3);
      expect(eth.length).toBeGreaterThanOrEqual(4);
    });

    it("Arbitrum collateral assets have valid addresses", () => {
      expect(COLLATERAL_ASSETS_ARBITRUM.length).toBeGreaterThan(0);
      for (const a of COLLATERAL_ASSETS_ARBITRUM) {
        expect(a.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
        expect(["BTC", "ETH"]).toContain(a.category);
      }
    });

    it("Base collateral assets include cbBTC", () => {
      expect(COLLATERAL_ASSETS_BASE.some((a) => a.symbol === "cbBTC")).toBe(true);
    });

    it("all collateral assets reference their chain's TOKENS", () => {
      for (const a of COLLATERAL_ASSETS) {
        expect(TOKENS[a.symbol]).toBe(a.address);
      }
      for (const a of COLLATERAL_ASSETS_ARBITRUM) {
        expect(TOKENS_ARBITRUM[a.symbol]).toBe(a.address);
      }
      for (const a of COLLATERAL_ASSETS_BASE) {
        expect(TOKENS_BASE[a.symbol]).toBe(a.address);
      }
    });
  });

  describe("Chainlink feeds", () => {
    it("has BTC/USD and ETH/USD feeds", () => {
      expect(CHAINLINK_FEEDS["BTC/USD"]).toBeDefined();
      expect(CHAINLINK_FEEDS["ETH/USD"]).toBeDefined();
    });

    it("TOKEN_PRICE_FEED maps all collateral tokens to feeds", () => {
      for (const asset of COLLATERAL_ASSETS) {
        expect(TOKEN_PRICE_FEED[asset.symbol]).toBeDefined();
      }
    });
  });

  describe("Cache TTL", () => {
    it("has reasonable TTL values", () => {
      expect(CACHE_TTL.rates).toBeGreaterThanOrEqual(60);
      expect(CACHE_TTL.prices).toBeGreaterThanOrEqual(30);
      expect(CACHE_TTL.position).toBeGreaterThanOrEqual(10);
      expect(CACHE_TTL.yield).toBeGreaterThanOrEqual(300);
    });
  });

  describe("Morpho markets", () => {
    it("all markets have valid market IDs", () => {
      for (const m of MORPHO_MARKETS) {
        expect(m.id).toMatch(/^0x[0-9a-f]{64}$/);
      }
    });

    it("all markets use Morpho adaptive curve IRM", () => {
      for (const m of MORPHO_MARKETS) {
        expect(m.irm.toLowerCase()).toBe(MORPHO.adaptiveCurveIrm.toLowerCase());
      }
    });

    it("all markets have USDC as loan token", () => {
      for (const m of MORPHO_MARKETS) {
        expect(m.loanToken.toLowerCase()).toBe(TOKENS.USDC.toLowerCase());
      }
    });
  });
});
