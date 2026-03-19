import { describe, it, expect } from "vitest";
import { handleTxGuard } from "../src/tools/tx-guard.js";

const LIFI_ROUTER = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
const AAVE_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const RANDOM_ADDR = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF";

const baseTx = {
  to: LIFI_ROUTER,
  data: "0x606326ff0000",
  value: "0xaa87bee5380000", // ~0.048 ETH
  gasLimit: "0xe4bc4",
  chainId: 1,
};

describe("tx.guard", () => {
  it("approves a tx within all limits", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: {
        maxValueNative: "0.1",
        allowedContracts: [LIFI_ROUTER],
        requireAllowlisted: true,
        maxGasLimit: 1_000_000,
      },
    });

    expect(result.approved).toBe(true);
    expect(result.failedCount).toBe(0);
    expect(result.summary).toContain("APPROVED");
  });

  it("blocks a tx exceeding max native value", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: { maxValueNative: "0.01" },
    });

    expect(result.approved).toBe(false);
    expect(result.failedCount).toBe(1);
    const checks = result.checks as Array<{ rule: string; status: string }>;
    expect(checks.find((c) => c.rule === "maxValueNative")?.status).toBe("fail");
  });

  it("blocks a tx to an address not in allowlist", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: { allowedContracts: [AAVE_POOL] },
    });

    expect(result.approved).toBe(false);
    const checks = result.checks as Array<{ rule: string; status: string }>;
    expect(checks.find((c) => c.rule === "allowedContracts")?.status).toBe("fail");
  });

  it("blocks a tx to a blocklisted address", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: { blockedContracts: [LIFI_ROUTER] },
    });

    expect(result.approved).toBe(false);
    const checks = result.checks as Array<{ rule: string; status: string }>;
    expect(checks.find((c) => c.rule === "blockedContracts")?.status).toBe("fail");
  });

  it("passes blocklist check when address is not blocked", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: { blockedContracts: [RANDOM_ADDR] },
    });

    expect(result.approved).toBe(true);
  });

  it("passes requireAllowlisted for known contracts", async () => {
    const result = await handleTxGuard({
      transaction: { ...baseTx, to: AAVE_POOL },
      rules: { requireAllowlisted: true },
    });

    expect(result.approved).toBe(true);
    const checks = result.checks as Array<{ rule: string; status: string; detail: string }>;
    const check = checks.find((c) => c.rule === "requireAllowlisted");
    expect(check?.status).toBe("pass");
    expect(check?.detail).toContain("Aave");
  });

  it("fails requireAllowlisted for unknown contracts", async () => {
    const result = await handleTxGuard({
      transaction: { ...baseTx, to: RANDOM_ADDR },
      rules: { requireAllowlisted: true },
    });

    expect(result.approved).toBe(false);
    const checks = result.checks as Array<{ rule: string; status: string }>;
    expect(checks.find((c) => c.rule === "requireAllowlisted")?.status).toBe("fail");
  });

  it("blocks when gas limit exceeds max", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: { maxGasLimit: 100_000 },
    });

    expect(result.approved).toBe(false);
    const checks = result.checks as Array<{ rule: string; status: string }>;
    expect(checks.find((c) => c.rule === "maxGasLimit")?.status).toBe("fail");
  });

  it("passes when gas limit is under max", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: { maxGasLimit: 2_000_000 },
    });

    expect(result.approved).toBe(true);
  });

  it("marks requireVerifiedContract as skip (needs tx.verify)", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: { requireVerifiedContract: true },
    });

    expect(result.approved).toBe(false);
    expect(result.skippedCount).toBe(1);
    expect(result.summary).toContain("REVIEW");
  });

  it("evaluates multiple rules together", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: {
        maxValueNative: "1.0",
        allowedContracts: [LIFI_ROUTER],
        requireAllowlisted: true,
        maxGasLimit: 2_000_000,
      },
    });

    expect(result.approved).toBe(true);
    expect(result.passedCount).toBe(4);
    expect(result.failedCount).toBe(0);
  });

  it("rejects empty rules", async () => {
    await expect(
      handleTxGuard({ transaction: baseTx, rules: {} })
    ).rejects.toThrow("At least one rule");
  });

  it("rejects missing to address", async () => {
    await expect(
      handleTxGuard({
        transaction: { to: "", data: "0x", from: "0x1234" } as any,
        rules: { maxValueNative: "1.0" },
      })
    ).rejects.toThrow("transaction.to is required");
  });

  it("handles tx with no value (defaults to 0)", async () => {
    const result = await handleTxGuard({
      transaction: { to: LIFI_ROUTER, data: "0x" },
      rules: { maxValueNative: "0.01" },
    });

    expect(result.approved).toBe(true);
    const checks = result.checks as Array<{ rule: string; detail: string }>;
    expect(checks[0].detail).toContain("0");
  });

  it("resolves chain from transaction chainId", async () => {
    const result = await handleTxGuard({
      transaction: { ...baseTx, chainId: 8453 },
      rules: { requireAllowlisted: true },
    });

    expect(result.chain).toBe("base");
  });

  it("case-insensitive address matching in allowlist", async () => {
    const result = await handleTxGuard({
      transaction: baseTx,
      rules: { allowedContracts: [LIFI_ROUTER.toLowerCase()] },
    });

    expect(result.approved).toBe(true);
  });
});
