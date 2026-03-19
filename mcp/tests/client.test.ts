import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Chain-aware Client Factory", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.ALCHEMY_API_KEY;
    process.env.ALCHEMY_API_KEY = "test-key-123";
    vi.resetModules();
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.ALCHEMY_API_KEY = originalKey;
    } else {
      delete process.env.ALCHEMY_API_KEY;
    }
  });

  it("creates an Ethereum client", async () => {
    const { getClient } = await import("../src/data/client.js");
    const client = getClient("ethereum");
    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(1);
  });

  it("creates an Arbitrum client", async () => {
    const { getClient } = await import("../src/data/client.js");
    const client = getClient("arbitrum");
    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(42161);
  });

  it("creates a Base client", async () => {
    const { getClient } = await import("../src/data/client.js");
    const client = getClient("base");
    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(8453);
  });

  it("creates a BSC client with public RPC", async () => {
    const { getClient } = await import("../src/data/client.js");
    const client = getClient("bsc");
    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(56);
  });

  it("defaults to ethereum when no chain specified", async () => {
    const { getClient } = await import("../src/data/client.js");
    const client = getClient();
    expect(client.chain?.id).toBe(1);
  });

  it("returns the same client instance for repeated calls", async () => {
    const { getClient } = await import("../src/data/client.js");
    const c1 = getClient("arbitrum");
    const c2 = getClient("arbitrum");
    expect(c1).toBe(c2);
  });

  it("exports ALL_LENDING_CHAINS", async () => {
    const { ALL_LENDING_CHAINS } = await import("../src/data/client.js");
    expect(ALL_LENDING_CHAINS).toContain("ethereum");
    expect(ALL_LENDING_CHAINS).toContain("arbitrum");
    expect(ALL_LENDING_CHAINS).toContain("base");
    expect(ALL_LENDING_CHAINS).toContain("bsc");
    expect(ALL_LENDING_CHAINS.length).toBe(4);
  });
});
