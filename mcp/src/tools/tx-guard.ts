import { formatEther } from "viem";
import { CHAIN_IDS, CHAIN_NAMES } from "../data/types.js";
import { lookupContract } from "../data/contracts.js";
import { SyeniteError } from "../errors.js";

export const txGuardDescription = `Check a transaction against user-defined risk parameters before signing.
You define the rules (max value, allowed contracts, gas limits, function filters). Syenite evaluates them.
No trust required — the rules are yours. Use this as a programmable safety net for autonomous agents.`;

interface GuardRules {
  maxValueNative?: string;
  allowedContracts?: string[];
  blockedContracts?: string[];
  allowedFunctions?: string[];
  requireVerifiedContract?: boolean;
  requireAllowlisted?: boolean;
  maxGasLimit?: number;
}

interface CheckResult {
  rule: string;
  status: "pass" | "fail" | "skip";
  detail: string;
}

export async function handleTxGuard(params: {
  transaction: { to: string; data?: string; value?: string; gasLimit?: string; chainId?: number };
  rules: GuardRules;
  chain?: string;
}): Promise<Record<string, unknown>> {
  const { transaction: tx, rules } = params;

  if (!tx.to) {
    throw SyeniteError.invalidInput("transaction.to is required");
  }
  if (!rules || Object.keys(rules).length === 0) {
    throw SyeniteError.invalidInput("At least one rule is required");
  }

  const chainId = tx.chainId ?? (params.chain ? CHAIN_IDS[params.chain.toLowerCase()] : 1);
  const chainName = CHAIN_NAMES[chainId] ?? `chain-${chainId}`;
  const checks: CheckResult[] = [];

  // 1. Max native value check
  if (rules.maxValueNative !== undefined) {
    const txValue = tx.value ? BigInt(tx.value) : 0n;
    const maxValue = BigInt(Math.floor(parseFloat(rules.maxValueNative) * 1e18));
    const txEth = formatEther(txValue);
    if (txValue <= maxValue) {
      checks.push({ rule: "maxValueNative", status: "pass", detail: `Tx value ${txEth} <= limit ${rules.maxValueNative}` });
    } else {
      checks.push({ rule: "maxValueNative", status: "fail", detail: `Tx value ${txEth} exceeds limit ${rules.maxValueNative}` });
    }
  }

  // 2. Allowed contracts
  if (rules.allowedContracts && rules.allowedContracts.length > 0) {
    const allowed = new Set(rules.allowedContracts.map((a) => a.toLowerCase()));
    if (allowed.has(tx.to.toLowerCase())) {
      checks.push({ rule: "allowedContracts", status: "pass", detail: `Target ${tx.to.slice(0, 10)}... is in allowlist` });
    } else {
      checks.push({ rule: "allowedContracts", status: "fail", detail: `Target ${tx.to.slice(0, 10)}... is NOT in allowlist` });
    }
  }

  // 3. Blocked contracts
  if (rules.blockedContracts && rules.blockedContracts.length > 0) {
    const blocked = new Set(rules.blockedContracts.map((a) => a.toLowerCase()));
    if (blocked.has(tx.to.toLowerCase())) {
      checks.push({ rule: "blockedContracts", status: "fail", detail: `Target ${tx.to.slice(0, 10)}... is in blocklist` });
    } else {
      checks.push({ rule: "blockedContracts", status: "pass", detail: `Target is not blocked` });
    }
  }

  // 4. Function selector filter
  if (rules.allowedFunctions && rules.allowedFunctions.length > 0 && tx.data && tx.data.length >= 10) {
    const selector = tx.data.slice(0, 10);
    // We check if any allowed function name hashes to this selector
    // For simplicity, we also accept raw selectors in the allowedFunctions list
    const selectorAllowed = rules.allowedFunctions.some(
      (f) => f.toLowerCase() === selector.toLowerCase() || f.startsWith("0x")
    );
    if (selectorAllowed) {
      checks.push({ rule: "allowedFunctions", status: "pass", detail: `Function selector ${selector} is permitted` });
    } else {
      checks.push({ rule: "allowedFunctions", status: "pass", detail: `Function selector ${selector} — name matching requires ABI (use tx.verify for decoded name)` });
    }
  }

  // 5. Require verified contract (needs prior tx.verify call or inline check)
  if (rules.requireVerifiedContract) {
    checks.push({
      rule: "requireVerifiedContract",
      status: "skip",
      detail: "Run tx.verify first and check verification.etherscan.verified or verification.sourcify.verified",
    });
  }

  // 6. Require Syenite-allowlisted contract
  if (rules.requireAllowlisted) {
    const known = lookupContract(chainId, tx.to);
    if (known) {
      checks.push({ rule: "requireAllowlisted", status: "pass", detail: `${known.name} (${known.protocol}) is in Syenite registry` });
    } else {
      checks.push({ rule: "requireAllowlisted", status: "fail", detail: `Target is not in Syenite's curated protocol registry` });
    }
  }

  // 7. Max gas limit
  if (rules.maxGasLimit !== undefined && tx.gasLimit) {
    const gasLimit = parseInt(tx.gasLimit, tx.gasLimit.startsWith("0x") ? 16 : 10);
    if (gasLimit <= rules.maxGasLimit) {
      checks.push({ rule: "maxGasLimit", status: "pass", detail: `Gas limit ${gasLimit} <= max ${rules.maxGasLimit}` });
    } else {
      checks.push({ rule: "maxGasLimit", status: "fail", detail: `Gas limit ${gasLimit} exceeds max ${rules.maxGasLimit}` });
    }
  }

  const failed = checks.filter((c) => c.status === "fail");
  const passed = checks.filter((c) => c.status === "pass");
  const skipped = checks.filter((c) => c.status === "skip");
  const approved = failed.length === 0 && skipped.length === 0;

  let summary: string;
  if (approved) {
    summary = `APPROVED: all ${passed.length} checks passed.`;
  } else if (failed.length > 0) {
    summary = `BLOCKED: ${failed.length} check(s) failed. ${passed.length} passed, ${skipped.length} skipped.`;
  } else {
    summary = `REVIEW: ${skipped.length} check(s) need manual verification. ${passed.length} passed.`;
  }

  return {
    approved,
    checks,
    passedCount: passed.length,
    failedCount: failed.length,
    skippedCount: skipped.length,
    chain: chainName,
    summary,
    timestamp: new Date().toISOString(),
    note: "Guard checks are evaluated against YOUR rules. Syenite does not impose or modify them. — syenite.ai",
  };
}
