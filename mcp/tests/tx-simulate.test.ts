import { describe, it, expect, vi } from "vitest";
import { handleTxSimulate } from "../src/tools/tx-simulate.js";

// These tests mock the viem client to avoid network calls

vi.mock("../src/data/client.js", () => {
  const mockClient = {
    getBlockNumber: vi.fn().mockResolvedValue(12345678n),
    getBalance: vi.fn().mockResolvedValue(100000000000000000n), // 0.1 ETH
    call: vi.fn().mockResolvedValue({ data: "0x" }),
    estimateGas: vi.fn().mockResolvedValue(250000n),
    getGasPrice: vi.fn().mockResolvedValue(20000000000n), // 20 gwei
    readContract: vi.fn().mockResolvedValue(0n),
    chain: { id: 1 },
  };

  return {
    getClient: vi.fn().mockReturnValue(mockClient),
    ALL_LENDING_CHAINS: ["ethereum", "arbitrum", "base", "bsc"],
  };
});

describe("tx.simulate", () => {
  it("simulates a successful transaction", async () => {
    const result = await handleTxSimulate({
      transaction: {
        to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
        data: "0x606326ff",
        value: "0x2386F26FC10000", // 0.01 ETH
        from: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
        chainId: 1,
      },
    });

    expect(result.success).toBe(true);
    expect(result.gasUsed).toBe(250000);
    expect(result.simulatedAtBlock).toBe(12345678);
    expect(result.chain).toBe("ethereum");
    expect(result.verification).toContain("eth_call");
    expect(result.verification).toContain("12345678");

    const changes = result.balanceChanges as Array<Record<string, unknown>>;
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0].direction).toBe("outflow");
    expect(changes[0].token).toBe("ETH");
  });

  it("simulates with zero value (no balance change for native)", async () => {
    const result = await handleTxSimulate({
      transaction: {
        to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
        data: "0x606326ff",
        from: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
      },
      chain: "ethereum",
    });

    expect(result.success).toBe(true);
    const changes = result.balanceChanges as unknown[];
    expect(changes.length).toBe(0);
  });

  it("reports gas estimate in USD", async () => {
    const result = await handleTxSimulate({
      transaction: {
        to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
        data: "0x606326ff",
        value: "0x2386F26FC10000",
        from: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
      },
      chain: "ethereum",
    });

    expect(result.gasEstimateUSD).toMatch(/^\$\d+\.\d+/);
  });

  it("detects approval requirement on revert", async () => {
    const { getClient } = await import("../src/data/client.js");
    const client = getClient("ethereum") as any;
    client.call.mockRejectedValueOnce(new Error("ERC20: insufficient allowance"));

    const result = await handleTxSimulate({
      transaction: {
        to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        data: "0xa9059cbb",
        from: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
      },
      chain: "ethereum",
    });

    expect(result.success).toBe(false);
    expect(result.revertReason).toBe("token_approval_required");
  });

  it("reports generic revert reason", async () => {
    const { getClient } = await import("../src/data/client.js");
    const client = getClient("ethereum") as any;
    client.call.mockRejectedValueOnce(new Error("execution reverted: insufficient balance"));

    const result = await handleTxSimulate({
      transaction: {
        to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
        data: "0x606326ff",
        from: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
      },
      chain: "ethereum",
    });

    expect(result.success).toBe(false);
    expect(result.revertReason).toContain("insufficient balance");
  });

  it("rejects missing to address", async () => {
    await expect(
      handleTxSimulate({
        transaction: { to: "", data: "0x", from: "0x1234" },
      })
    ).rejects.toThrow("transaction.to and transaction.from are required");
  });

  it("rejects missing from address", async () => {
    await expect(
      handleTxSimulate({
        transaction: { to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE", data: "0x", from: "" },
      })
    ).rejects.toThrow("transaction.to and transaction.from are required");
  });

  it("resolves chain from name", async () => {
    const result = await handleTxSimulate({
      transaction: {
        to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
        data: "0x606326ff",
        from: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
      },
      chain: "base",
    });

    expect(result.chain).toBe("base");
  });

  it("includes contracts called", async () => {
    const result = await handleTxSimulate({
      transaction: {
        to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
        data: "0x606326ff",
        from: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
      },
      chain: "ethereum",
    });

    const called = result.contractsCalled as string[];
    expect(called).toContain("0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE");
  });
});
