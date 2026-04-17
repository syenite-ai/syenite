import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";

import { getSolanaToken, resolveMint, listSolanaTokens } from "../src/data/solana/tokens.js";
import {
  getAccountInfo,
  getSolanaConnection,
  isSolanaAddress,
  resetSolanaConnection,
} from "../src/data/solana/client.js";

// ── Token registry ──────────────────────────────────────────────────

describe("Solana token registry", () => {
  it("resolves SOL by symbol", () => {
    const sol = getSolanaToken("SOL");
    expect(sol?.mint).toBe("So11111111111111111111111111111111111111112");
    expect(sol?.decimals).toBe(9);
  });

  it("resolves mSOL by symbol (case-insensitive)", () => {
    const msol = getSolanaToken("msol");
    expect(msol?.symbol).toBe("mSOL");
    expect(msol?.mint).toBe("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");
  });

  it("resolves jitoSOL by symbol", () => {
    const jito = getSolanaToken("JITOSOL");
    expect(jito?.symbol).toBe("jitoSOL");
    expect(jito?.mint).toBe("J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn");
  });

  it("resolves USDC by symbol", () => {
    const usdc = getSolanaToken("USDC");
    expect(usdc?.mint).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(usdc?.decimals).toBe(6);
  });

  it("returns null for unknown symbols", () => {
    expect(getSolanaToken("NOT_A_TOKEN")).toBeNull();
    expect(getSolanaToken("")).toBeNull();
  });

  it("resolves by mint address", () => {
    const usdc = resolveMint("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(usdc?.symbol).toBe("USDC");
  });

  it("returns null for unknown mint", () => {
    expect(resolveMint("UnknownMint11111111111111111111111111111")).toBeNull();
  });

  it("lists deduplicated tokens (wSOL and SOL share a mint)", () => {
    const list = listSolanaTokens();
    const mints = list.map((t) => t.mint);
    expect(new Set(mints).size).toBe(mints.length);
    expect(list.length).toBeGreaterThanOrEqual(25);
  });
});

// ── Address validation ──────────────────────────────────────────────

describe("isSolanaAddress", () => {
  it("accepts a valid base58 pubkey", () => {
    expect(isSolanaAddress("So11111111111111111111111111111111111111112")).toBe(true);
    expect(isSolanaAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
  });

  it("rejects EVM addresses", () => {
    expect(isSolanaAddress("0x0000000000000000000000000000000000000000")).toBe(false);
  });

  it("rejects empty and obviously invalid inputs", () => {
    expect(isSolanaAddress("")).toBe(false);
    expect(isSolanaAddress("not-a-pubkey")).toBe(false);
  });
});

// ── Connection + getAccountInfo (mocked RPC) ────────────────────────

describe("getAccountInfo (mocked)", () => {
  beforeEach(() => {
    resetSolanaConnection();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSolanaConnection();
  });

  it("returns the account info returned by the RPC", async () => {
    const fakeInfo = {
      data: Buffer.alloc(0),
      executable: false,
      lamports: 1_000_000_000,
      owner: new PublicKey("11111111111111111111111111111111"),
      rentEpoch: 0,
    };
    const conn = getSolanaConnection();
    const spy = vi.spyOn(conn, "getAccountInfo").mockResolvedValue(fakeInfo as never);

    const result = await getAccountInfo("So11111111111111111111111111111111111111112");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toBe(fakeInfo);
  });

  it("returns null when the RPC call throws (never propagates)", async () => {
    const conn = getSolanaConnection();
    vi.spyOn(conn, "getAccountInfo").mockRejectedValue(new Error("rpc timeout"));

    const result = await getAccountInfo("So11111111111111111111111111111111111111112");

    expect(result).toBeNull();
  });

  it("accepts a PublicKey directly", async () => {
    const conn = getSolanaConnection();
    const spy = vi.spyOn(conn, "getAccountInfo").mockResolvedValue(null);
    const key = new PublicKey("So11111111111111111111111111111111111111112");

    await getAccountInfo(key);

    expect(spy).toHaveBeenCalledWith(key, "confirmed");
  });
});
