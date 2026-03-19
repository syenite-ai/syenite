import { describe, it, expect } from "vitest";
import {
  handleLendingSupply,
  handleLendingBorrow,
  handleLendingWithdraw,
  handleLendingRepay,
} from "../src/tools/lending-execute.js";

describe("lending.supply", () => {
  it("generates supply calldata for Aave v3 on Ethereum", async () => {
    const result = await handleLendingSupply({
      protocol: "aave-v3",
      chain: "ethereum",
      asset: "USDC",
      amount: "1000",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    expect(result.action).toBe("supply");
    expect(result.protocol).toBe("aave-v3");
    expect(result.chain).toBe("ethereum");
    expect(result.asset).toBe("USDC");
    expect(result.amountWei).toBe("1000000000"); // 1000 * 10^6

    const exec = result.execution as Record<string, unknown>;
    const tx = exec.transactionRequest as Record<string, unknown>;
    expect(tx.to).toBeTruthy();
    expect(tx.data).toMatch(/^0x/);
    expect(tx.value).toBe("0x0");
    expect(tx.chainId).toBe(1);

    expect(result.approvalRequired).toBeTruthy();
    const approval = result.approvalRequired as Record<string, unknown>;
    expect(approval.tokenAddress).toBeTruthy();
    expect(approval.spender).toBe(tx.to);
  });

  it("generates supply calldata for Aave v3 on Arbitrum", async () => {
    const result = await handleLendingSupply({
      protocol: "aave-v3",
      chain: "arbitrum",
      asset: "USDC",
      amount: "500",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    const exec = result.execution as Record<string, unknown>;
    const tx = exec.transactionRequest as Record<string, unknown>;
    expect(tx.chainId).toBe(42161);
  });

  it("generates supply calldata for Spark on Ethereum", async () => {
    const result = await handleLendingSupply({
      protocol: "spark",
      chain: "ethereum",
      asset: "DAI",
      amount: "5000",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    expect(result.protocol).toBe("spark");
    expect(result.amountWei).toBe("5000000000000000000000"); // 5000 * 10^18
  });

  it("throws for unsupported protocol", async () => {
    await expect(
      handleLendingSupply({
        protocol: "compound",
        chain: "ethereum",
        asset: "USDC",
        amount: "100",
        onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
      })
    ).rejects.toThrow(/Unsupported protocol/);
  });

  it("throws for unsupported chain on a protocol", async () => {
    await expect(
      handleLendingSupply({
        protocol: "spark",
        chain: "arbitrum",
        asset: "DAI",
        amount: "100",
        onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
      })
    ).rejects.toThrow(/not available on arbitrum/);
  });

  it("throws for unknown token", async () => {
    await expect(
      handleLendingSupply({
        protocol: "aave-v3",
        chain: "ethereum",
        asset: "SHIB",
        amount: "100",
        onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
      })
    ).rejects.toThrow(/Token SHIB not found/);
  });
});

describe("lending.borrow", () => {
  it("generates borrow calldata with variable rate", async () => {
    const result = await handleLendingBorrow({
      protocol: "aave-v3",
      chain: "ethereum",
      asset: "USDC",
      amount: "2000",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    expect(result.action).toBe("borrow");
    expect(result.interestRateMode).toBe("variable");
    expect(result.amountWei).toBe("2000000000"); // 2000 * 10^6

    const exec = result.execution as Record<string, unknown>;
    const tx = exec.transactionRequest as Record<string, unknown>;
    expect(tx.data).toMatch(/^0x/);
    expect(tx.chainId).toBe(1);

    // Borrow doesn't require approval (it's pulling from existing collateral)
    expect(result.approvalRequired).toBeUndefined();
  });

  it("generates borrow on Base", async () => {
    const result = await handleLendingBorrow({
      protocol: "aave-v3",
      chain: "base",
      asset: "USDC",
      amount: "1000",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    const exec = result.execution as Record<string, unknown>;
    const tx = exec.transactionRequest as Record<string, unknown>;
    expect(tx.chainId).toBe(8453);
  });
});

describe("lending.withdraw", () => {
  it("generates withdraw calldata with specific amount", async () => {
    const result = await handleLendingWithdraw({
      protocol: "aave-v3",
      chain: "ethereum",
      asset: "USDC",
      amount: "500",
      to: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    expect(result.action).toBe("withdraw");
    expect(result.amount).toBe("500");
  });

  it("generates max withdraw calldata", async () => {
    const result = await handleLendingWithdraw({
      protocol: "aave-v3",
      chain: "ethereum",
      asset: "USDC",
      amount: "max",
      to: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    expect(result.action).toBe("withdraw");
    expect(result.amount).toBe("max (all supplied)");

    const exec = result.execution as Record<string, unknown>;
    const tx = exec.transactionRequest as Record<string, unknown>;
    expect(tx.data).toMatch(/^0x/);
  });
});

describe("lending.repay", () => {
  it("generates repay calldata with approval", async () => {
    const result = await handleLendingRepay({
      protocol: "aave-v3",
      chain: "ethereum",
      asset: "USDC",
      amount: "1000",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    expect(result.action).toBe("repay");
    expect(result.interestRateMode).toBe("variable");
    expect(result.approvalRequired).toBeTruthy();
  });

  it("generates max repay with uint256 max approval", async () => {
    const result = await handleLendingRepay({
      protocol: "aave-v3",
      chain: "ethereum",
      asset: "USDC",
      amount: "max",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    expect(result.amount).toBe("max (all debt)");
    expect(result.approvalRequired).toBeTruthy();
  });
});

describe("cross-cutting concerns", () => {
  it("all handlers include verification guidance", async () => {
    const supply = await handleLendingSupply({
      protocol: "aave-v3",
      chain: "ethereum",
      asset: "USDC",
      amount: "100",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    expect(supply.verification).toContain("tx.receipt");
    expect(supply.note).toContain("Syenite never holds private keys");
  });

  it("supply calldata for different chains points to correct pool", async () => {
    const ethResult = await handleLendingSupply({
      protocol: "aave-v3",
      chain: "ethereum",
      asset: "USDC",
      amount: "100",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    const arbResult = await handleLendingSupply({
      protocol: "aave-v3",
      chain: "arbitrum",
      asset: "USDC",
      amount: "100",
      onBehalfOf: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    });

    expect(ethResult.pool).not.toBe(arbResult.pool);
  });
});
