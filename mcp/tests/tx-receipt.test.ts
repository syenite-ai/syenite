import { describe, it, expect, vi } from "vitest";
import { handleTxReceipt } from "../src/tools/tx-receipt.js";

vi.mock("../src/data/client.js", () => {
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const approvalTopic = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

  const mockReceipt = {
    status: "success",
    blockNumber: 19500000n,
    from: "0x8d0EDB96615A6520B989bD33d2EaB5150694F492",
    to: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    gasUsed: 150000n,
    effectiveGasPrice: 25000000000n, // 25 gwei
    logs: [
      {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        topics: [
          approvalTopic,
          "0x0000000000000000000000008d0edb96615a6520b989bd33d2eab5150694f492",
          "0x00000000000000000000000087870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
        ],
        data: "0x000000000000000000000000000000000000000000000000000000003b9aca00",
        logIndex: 0,
      },
      {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        topics: [
          transferTopic,
          "0x0000000000000000000000008d0edb96615a6520b989bd33d2eab5150694f492",
          "0x00000000000000000000000087870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
        ],
        data: "0x000000000000000000000000000000000000000000000000000000003b9aca00",
        logIndex: 1,
      },
    ],
  };

  const mockTx = {
    nonce: 42,
    gas: 300000n,
    value: 0n,
  };

  const mockClient = {
    getTransactionReceipt: vi.fn().mockResolvedValue(mockReceipt),
    getTransaction: vi.fn().mockResolvedValue(mockTx),
  };

  const mockRevertClient = {
    getTransactionReceipt: vi.fn().mockResolvedValue({
      ...mockReceipt,
      status: "reverted",
      logs: [],
    }),
    getTransaction: vi.fn().mockResolvedValue(mockTx),
  };

  const mockNotFoundClient = {
    getTransactionReceipt: vi.fn().mockRejectedValue(new Error("not found")),
    getTransaction: vi.fn().mockRejectedValue(new Error("not found")),
  };

  let callCount = 0;
  return {
    getClient: vi.fn().mockImplementation((chain: string) => {
      if (chain === "bsc") return mockNotFoundClient;
      if (chain === "arbitrum") return mockRevertClient;
      return mockClient;
    }),
    ALL_LENDING_CHAINS: ["ethereum", "arbitrum", "base", "bsc"],
  };
});

describe("tx.receipt", () => {
  it("returns a confirmed receipt with gas costs", async () => {
    const result = await handleTxReceipt({
      txHash: "0xabc123",
      chain: "ethereum",
    });

    expect(result.status).toBe("confirmed");
    expect(result.success).toBe(true);
    expect(result.blockNumber).toBe(19500000);
    expect(result.from).toBe("0x8d0EDB96615A6520B989bD33d2EaB5150694F492");

    const gas = result.gas as Record<string, unknown>;
    expect(gas.gasUsed).toBe(150000);
    expect(gas.gasLimit).toBe(300000);
    expect(gas.effectiveGasPrice).toContain("gwei");
    expect(gas.costNative).toContain("ETH");
    expect(gas.costUSD).toMatch(/\$[\d.]+/);
  });

  it("decodes event logs correctly", async () => {
    const result = await handleTxReceipt({
      txHash: "0xabc123",
      chain: "ethereum",
    });

    const logs = result.logs as Record<string, unknown>;
    expect(logs.totalEvents).toBe(2);
    const decoded = logs.decoded as Array<Record<string, unknown>>;
    expect(decoded[0].event).toBe("Approval");
    expect(decoded[1].event).toBe("Transfer");
  });

  it("extracts token transfers from Transfer events", async () => {
    const result = await handleTxReceipt({
      txHash: "0xabc123",
      chain: "ethereum",
    });

    const transfers = result.tokenTransfers as Array<Record<string, unknown>>;
    expect(transfers).toBeDefined();
    expect(transfers.length).toBe(1);
    expect(transfers[0].token).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  });

  it("includes explorer URL", async () => {
    const result = await handleTxReceipt({
      txHash: "0xabc123",
      chain: "ethereum",
    });

    expect(result.explorerUrl).toBe("https://etherscan.io/tx/0xabc123");
  });

  it("handles reverted transactions", async () => {
    const result = await handleTxReceipt({
      txHash: "0xreverted",
      chain: "arbitrum",
    });

    expect(result.status).toBe("reverted");
    expect(result.success).toBe(false);
  });

  it("throws for transaction not found", async () => {
    await expect(
      handleTxReceipt({
        txHash: "0xnotfound",
        chain: "bsc",
      })
    ).rejects.toThrow(/not found on bsc/);
  });

  it("resolves chain aliases", async () => {
    const result = await handleTxReceipt({
      txHash: "0xabc123",
      chain: "eth",
    });

    expect(result.chain).toBe("ethereum");
  });

  it("throws for unsupported chain", async () => {
    await expect(
      handleTxReceipt({
        txHash: "0xabc",
        chain: "solana",
      })
    ).rejects.toThrow(/Unsupported chain/);
  });

  it("defaults to ethereum when chain not specified", async () => {
    const result = await handleTxReceipt({
      txHash: "0xabc123",
    });

    expect(result.chain).toBe("ethereum");
  });
});
