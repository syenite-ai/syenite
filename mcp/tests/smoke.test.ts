/**
 * Smoke tests — live RPC calls against real chains.
 * Validates that all core tool handlers work end-to-end.
 * Uses ALCHEMY_API_KEY if set, otherwise falls back to public RPCs.
 */

import { describe, it, expect } from "vitest";
import { handleTxSimulate } from "../src/tools/tx-simulate.js";
import { handleTxVerify } from "../src/tools/tx-verify.js";
import { handleTxGuard } from "../src/tools/tx-guard.js";
import { handleGasEstimate } from "../src/tools/gas.js";
import { handleWalletBalances } from "../src/tools/wallet.js";
import { handleRatesQuery } from "../src/tools/rates.js";
import { handleMarketOverview } from "../src/tools/market.js";
import { handleYieldOpportunities } from "../src/tools/yield.js";
import { handleRiskAssess } from "../src/tools/risk.js";
import { handleCarryScreener } from "../src/tools/carry.js";
import { handleTokenPrice } from "../src/tools/token-price.js";
import { handleTxReceipt } from "../src/tools/tx-receipt.js";

const AAVE_V3_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

describe("Smoke tests — live RPC", { timeout: 30_000 }, () => {

  it("tx.simulate — simple ETH transfer on ethereum", async () => {
    const result = await handleTxSimulate({
      transaction: {
        to: USDC_ETH,
        data: "0x",
        value: "0",
        from: VITALIK,
      },
      chain: "ethereum",
    });
    expect(result).toBeDefined();
    expect(result.chain).toBe("ethereum");
    expect(result.simulatedAtBlock).toBeGreaterThan(0);
    expect(typeof result.success).toBe("boolean");
    expect(result.verification).toContain("Simulated via eth_call");
    console.log("  tx.simulate:", result.success ? "OK" : "reverted", `block ${result.simulatedAtBlock}, gas: ${result.gasUsed}`);
  });

  it("tx.verify — check Aave V3 Pool contract", async () => {
    const result = await handleTxVerify({ to: AAVE_V3_POOL, chain: "ethereum" });
    expect(result).toBeDefined();
    expect(result.chain).toBe("ethereum");
    console.log("  tx.verify:", JSON.stringify(result.verification ?? result).slice(0, 200));
  });

  it("tx.guard — check rules against a tx", async () => {
    const result = await handleTxGuard({
      transaction: { to: AAVE_V3_POOL, data: "0x", value: "0", chainId: 1 },
      rules: {
        maxValueNative: "1.0",
        requireAllowlisted: true,
      },
    });
    expect(result).toBeDefined();
    expect(result.checks).toBeDefined();
    expect(Array.isArray(result.checks)).toBe(true);
    console.log("  tx.guard:", result.summary);
  });

  it("gas.estimate — ethereum gas prices", async () => {
    const result = await handleGasEstimate({ chains: ["ethereum"] });
    expect(result).toBeDefined();
    expect(result.chainsQueried).toContain("ethereum");
    const estimates = result.estimates as Array<{ chain: string; gasPrice: { gwei: string } }>;
    expect(estimates.length).toBeGreaterThan(0);
    console.log("  gas.estimate:", estimates[0].chain, estimates[0].gasPrice.gwei, "gwei");
  });

  it("wallet.balances — Vitalik on ethereum", async () => {
    const result = await handleWalletBalances({ address: VITALIK, chains: ["ethereum"] });
    expect(result).toBeDefined();
    expect((result.address as string).toLowerCase()).toBe(VITALIK.toLowerCase());
    const balances = result.balances as Array<{ asset: string; balance: string }>;
    expect(balances.length).toBeGreaterThan(0);
    console.log("  wallet.balances:", balances.map((b) => `${b.asset}: ${b.balance}`).join(", "));
  });

  it("rates — fetch current lending rates", async () => {
    const result = await handleRatesQuery({ asset: "USDC", protocol: "aave" });
    expect(result).toBeDefined();
    console.log("  rates:", JSON.stringify(result).slice(0, 200));
  });

  it("market.overview — DeFi market snapshot", async () => {
    const result = await handleMarketOverview({});
    expect(result).toBeDefined();
    console.log("  market.overview:", Object.keys(result).join(", "));
  });

  it("yield.opportunities — top yields", async () => {
    const result = await handleYieldOpportunities({ asset: "USDC", minTvl: 1000000 });
    expect(result).toBeDefined();
    console.log("  yield:", JSON.stringify(result).slice(0, 200));
  });

  it("risk.assess — tBTC collateral assessment", async () => {
    const result = await handleRiskAssess({
      collateral: "tBTC",
      collateralAmount: 2,
      borrowAsset: "USDC",
      targetLTV: 35,
    });
    expect(result).toBeDefined();
    console.log("  risk.assess:", JSON.stringify(result).slice(0, 200));
  });

  it("carry.screen — carry trade opportunities", async () => {
    const result = await handleCarryScreener({
      collateral: "tBTC",
      borrowAsset: "USDC",
    });
    expect(result).toBeDefined();
    console.log("  carry.screen:", JSON.stringify(result).slice(0, 200));
  });

  it("token.price — ETH price", async () => {
    const result = await handleTokenPrice({ token: "ETH" });
    expect(result).toBeDefined();
    console.log("  token.price:", JSON.stringify(result).slice(0, 200));
  });

  it("tx.receipt — known tx hash", async () => {
    const result = await handleTxReceipt({
      txHash: "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060",
      chain: "ethereum",
    });
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
    console.log("  tx.receipt: status", result.status);
  });
});
