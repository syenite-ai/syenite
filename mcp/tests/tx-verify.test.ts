import { describe, it, expect, vi } from "vitest";
import { handleTxVerify } from "../src/tools/tx-verify.js";

// Mock viem client and fetch to avoid network calls
vi.mock("../src/data/client.js", () => {
  const mockClient = {
    getCode: vi.fn().mockResolvedValue("0x6080604052"),
    chain: { id: 1 },
  };

  return {
    getClient: vi.fn().mockReturnValue(mockClient),
    ALL_LENDING_CHAINS: ["ethereum", "arbitrum", "base", "bsc"],
  };
});

// Mock fetch for Etherscan/Sourcify/4byte APIs
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockEtherscanResponse(verified: boolean, contractName = "TestContract") {
  return {
    ok: true,
    json: () => Promise.resolve({
      status: "1",
      result: [
        {
          SourceCode: verified ? "pragma solidity..." : "",
          ContractName: verified ? contractName : "",
          CompilerVersion: verified ? "v0.8.17" : "",
          Proxy: "0",
          Implementation: "",
        },
      ],
    }),
  };
}

function mockSourcifyResponse(verified: boolean) {
  return {
    ok: true,
    json: () =>
      Promise.resolve(
        verified
          ? [{ chainIds: [{ chainId: "1", status: "perfect" }] }]
          : [{ chainIds: [] }]
      ),
  };
}

function mock4ByteResponse(name: string | null) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        results: name ? [{ text_signature: name }] : [],
      }),
  };
}

describe("tx.verify", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("verifies a known Li.Fi contract", async () => {
    mockFetch
      .mockResolvedValueOnce(mockEtherscanResponse(true, "LiFiDiamond"))
      .mockResolvedValueOnce(mockSourcifyResponse(true));

    const result = await handleTxVerify({
      to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      chain: "ethereum",
    });

    expect(result.isContract).toBe(true);
    expect((result.protocol as any).identified).toBe(true);
    expect((result.protocol as any).name).toBe("Li.Fi");
    expect((result.protocol as any).syeniteAllowlisted).toBe(true);
    expect((result.verification as any).etherscan.verified).toBe(true);
    expect((result.verification as any).sourcify.verified).toBe(true);
    expect(result.riskFlagCount).toBe(0);
  });

  it("flags unknown unverified contract", async () => {
    mockFetch
      .mockResolvedValueOnce(mockEtherscanResponse(false))
      .mockResolvedValueOnce(mockSourcifyResponse(false));

    const result = await handleTxVerify({
      to: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
      chain: "ethereum",
    });

    const flags = result.riskFlags as string[];
    expect(flags).toContain("unverified_contract");
    expect(flags).toContain("unknown_protocol");
    expect((result.protocol as any).identified).toBe(false);
    expect((result.protocol as any).syeniteAllowlisted).toBe(false);
  });

  it("detects proxy contracts", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: "1",
          result: [{
            SourceCode: "pragma...",
            ContractName: "ProxyContract",
            CompilerVersion: "v0.8.17",
            Proxy: "1",
            Implementation: "0xabcdef",
          }],
        }),
      })
      .mockResolvedValueOnce(mockSourcifyResponse(true));

    const result = await handleTxVerify({
      to: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
      chain: "ethereum",
    });

    expect((result.verification as any).etherscan.proxy).toBe(true);
    const flags = result.riskFlags as string[];
    expect(flags).toContain("proxy_contract");
  });

  it("decodes function selector when data provided", async () => {
    mockFetch
      .mockResolvedValueOnce(mockEtherscanResponse(true))
      .mockResolvedValueOnce(mockSourcifyResponse(true))
      .mockResolvedValueOnce(mock4ByteResponse("transfer(address,uint256)"));

    const result = await handleTxVerify({
      to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      chain: "ethereum",
      data: "0xa9059cbb0000000000000000000000001234",
    });

    const fn = result.functionCalled as any;
    expect(fn.selector).toBe("0xa9059cbb");
    expect(fn.name).toBe("transfer(address,uint256)");
    expect(fn.decoded).toBe(true);
  });

  it("returns null functionCalled when no data provided", async () => {
    mockFetch
      .mockResolvedValueOnce(mockEtherscanResponse(true))
      .mockResolvedValueOnce(mockSourcifyResponse(true));

    const result = await handleTxVerify({
      to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      chain: "ethereum",
    });

    expect(result.functionCalled).toBeNull();
  });

  it("flags EOA targets", async () => {
    const { getClient } = await import("../src/data/client.js");
    const client = getClient("ethereum") as any;
    client.getCode.mockResolvedValueOnce("0x");

    mockFetch
      .mockResolvedValueOnce(mockEtherscanResponse(false))
      .mockResolvedValueOnce(mockSourcifyResponse(false));

    const result = await handleTxVerify({
      to: "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
      chain: "ethereum",
    });

    expect(result.isContract).toBe(false);
    const flags = result.riskFlags as string[];
    expect(flags).toContain("eoa_target");
    expect(result.summary).toContain("EOA");
  });

  it("rejects invalid address", async () => {
    await expect(
      handleTxVerify({ to: "not-an-address", chain: "ethereum" })
    ).rejects.toThrow("Invalid address");
  });

  it("rejects unsupported chain", async () => {
    await expect(
      handleTxVerify({ to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE", chain: "solana" })
    ).rejects.toThrow("Unsupported chain");
  });

  it("handles Etherscan API failure gracefully", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(mockSourcifyResponse(true));

    const result = await handleTxVerify({
      to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      chain: "ethereum",
    });

    expect((result.verification as any).etherscan.verified).toBe(false);
    expect((result.verification as any).sourcify.verified).toBe(true);
    // Known contract, so no unknown_protocol flag even though etherscan failed
    expect((result.protocol as any).identified).toBe(true);
  });

  it("includes summary with all verification sources", async () => {
    mockFetch
      .mockResolvedValueOnce(mockEtherscanResponse(true, "LiFiDiamond"))
      .mockResolvedValueOnce(mockSourcifyResponse(true));

    const result = await handleTxVerify({
      to: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      chain: "ethereum",
    });

    const summary = result.summary as string;
    expect(summary).toContain("Li.Fi");
    expect(summary).toContain("Etherscan verified");
    expect(summary).toContain("Sourcify");
  });
});
