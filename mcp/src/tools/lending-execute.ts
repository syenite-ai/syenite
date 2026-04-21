import { encodeFunctionData, parseUnits, type Address } from "viem";
import { SyeniteError } from "../errors.js";
import {
  AAVE_V3,
  AAVE_V3_ARBITRUM,
  AAVE_V3_BASE,
  SPARK,
  TOKENS,
  TOKENS_ARBITRUM,
  TOKENS_BASE,
  TOKEN_DECIMALS,
  TOKEN_DECIMALS_ARBITRUM,
  TOKEN_DECIMALS_BASE,
} from "../data/types.js";

export const lendingSupplyDescription = `Generates unsigned ERC-20 approval and pool supply transaction calldata for depositing an asset into Aave v3 (Ethereum, Arbitrum, Base) or Spark (Ethereum).
Call this when the agent has decided to supply collateral or earn supply APY on a lending protocol; precede it with \`lending.rates.query\` to confirm the target protocol and chain.
Provide \`protocol\` ("aave-v3" or "spark"), \`chain\`, \`asset\` symbol (e.g. "WETH", "USDC"), human-readable \`amount\`, and \`onBehalfOf\` wallet address.
Returns two transaction requests — the ERC-20 approval must be submitted first, then the supply call — and a verification reminder to use \`tx.receipt\` and \`lending.position.monitor\` after submission.
Syenite never holds private keys; no funds move until the caller signs and broadcasts.`;

export const lendingBorrowDescription = `Generates unsigned variable-rate borrow transaction calldata for Aave v3 (Ethereum, Arbitrum, Base) or Spark (Ethereum).
Call \`lending.risk.assess\` before this tool to confirm the target LTV is safe and the market has sufficient liquidity.
Provide \`protocol\`, \`chain\`, \`asset\` to borrow (e.g. "USDC"), human-readable \`amount\`, and \`onBehalfOf\` wallet address; collateral must already be supplied.
Returns one transaction request (no approval needed for borrows); Syenite never holds private keys and no funds move until the caller signs and broadcasts.`;

export const lendingWithdrawDescription = `Generates unsigned withdraw transaction calldata to reclaim a supplied asset from Aave v3 (Ethereum, Arbitrum, Base) or Spark (Ethereum).
Call \`lending.position.monitor\` first to confirm the withdrawal will not push an outstanding borrow position toward liquidation.
Provide \`protocol\`, \`chain\`, \`asset\`, a human-readable \`amount\` or the string "max" to withdraw the full supplied balance, and \`to\` as the recipient address.
Returns one transaction request; Syenite never holds private keys and no funds move until the caller signs and broadcasts.`;

export const lendingRepayDescription = `Generates unsigned ERC-20 approval and variable-rate repay transaction calldata for Aave v3 (Ethereum, Arbitrum, Base) or Spark (Ethereum).
Use this to reduce or eliminate an outstanding borrow; pass amount "max" (uint256 max) to repay the entire debt balance, or a specific human-readable amount for partial repayment.
Provide \`protocol\`, \`chain\`, \`asset\` being repaid, \`amount\`, and \`onBehalfOf\` wallet address.
Returns the ERC-20 approval transaction (submit first) and the repay transaction; Syenite never holds private keys and no funds move until the caller signs and broadcasts.`;

// ── Protocol pool addresses by chain ────────────────────────────────

interface PoolDeployment {
  pool: Address;
  tokens: Record<string, Address>;
  tokenDecimals: Record<string, number>;
  chainId: number;
}

const POOLS: Record<string, Record<string, PoolDeployment>> = {
  "aave-v3": {
    ethereum: { pool: AAVE_V3.pool, tokens: TOKENS, tokenDecimals: TOKEN_DECIMALS, chainId: 1 },
    arbitrum: { pool: AAVE_V3_ARBITRUM.pool, tokens: TOKENS_ARBITRUM, tokenDecimals: TOKEN_DECIMALS_ARBITRUM, chainId: 42161 },
    base: { pool: AAVE_V3_BASE.pool, tokens: TOKENS_BASE, tokenDecimals: TOKEN_DECIMALS_BASE, chainId: 8453 },
  },
  spark: {
    ethereum: { pool: SPARK.pool, tokens: TOKENS, tokenDecimals: TOKEN_DECIMALS, chainId: 1 },
  },
};

// Aave v3 / Spark share the same Pool interface
const POOL_ABI = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "borrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "referralCode", type: "uint16" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const UINT256_MAX = 2n ** 256n - 1n;

function resolvePool(protocol: string, chain: string): PoolDeployment {
  const protocolPools = POOLS[protocol];
  if (!protocolPools) {
    throw SyeniteError.invalidInput(`Unsupported protocol: ${protocol}. Supported: ${Object.keys(POOLS).join(", ")}`);
  }
  const deployment = protocolPools[chain];
  if (!deployment) {
    throw SyeniteError.invalidInput(`${protocol} not available on ${chain}. Available: ${Object.keys(protocolPools).join(", ")}`);
  }
  return deployment;
}

function resolveToken(symbol: string, deployment: PoolDeployment): { address: Address; decimals: number } {
  const upper = symbol.toUpperCase();
  const lower = symbol.toLowerCase();
  const address = deployment.tokens[symbol] ?? deployment.tokens[upper] ?? deployment.tokens[lower];
  if (!address) {
    throw SyeniteError.invalidInput(`Token ${symbol} not found. Available: ${Object.keys(deployment.tokens).join(", ")}`);
  }
  const decimals = deployment.tokenDecimals[symbol] ?? deployment.tokenDecimals[upper] ?? deployment.tokenDecimals[lower] ?? 18;
  return { address, decimals };
}

function buildResult(
  action: string,
  params: Record<string, unknown>,
  tx: { to: Address; data: `0x${string}`; chainId: number },
  approval?: { tokenAddress: Address; spender: Address; amount: string; approvalTx: { to: Address; data: `0x${string}`; chainId: number } }
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    action,
    ...params,
    execution: {
      instructions: "Sign and submit the transaction below from your wallet. Syenite does not hold private keys.",
      transactionRequest: {
        to: tx.to,
        data: tx.data,
        value: "0x0",
        chainId: tx.chainId,
      },
    },
  };

  if (approval) {
    result.approvalRequired = {
      note: `Token approval required before ${action}. Submit the approval transaction first, then the ${action} transaction.`,
      tokenAddress: approval.tokenAddress,
      spender: approval.spender,
      amount: approval.amount,
      transactionRequest: {
        to: approval.approvalTx.to,
        data: approval.approvalTx.data,
        value: "0x0",
        chainId: approval.approvalTx.chainId,
      },
    };
  }

  result.verification = `After submitting, use tx.receipt to verify success, then lending.position.monitor to check your updated position.`;
  result.note = "Transaction generated for the specified protocol and chain. Syenite never holds private keys. — syenite.ai";

  return result;
}

function buildApprovalTx(tokenAddress: Address, spender: Address, amount: bigint, chainId: number) {
  return {
    tokenAddress,
    spender,
    amount: amount.toString(),
    approvalTx: {
      to: tokenAddress,
      data: encodeFunctionData({
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [spender, amount],
      }),
      chainId,
    },
  };
}

// ── Handlers ────────────────────────────────────────────────────────

export async function handleLendingSupply(params: {
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
  onBehalfOf: string;
}): Promise<Record<string, unknown>> {
  const deployment = resolvePool(params.protocol, params.chain);
  const token = resolveToken(params.asset, deployment);
  const amountWei = parseUnits(params.amount, token.decimals);
  const onBehalfOf = params.onBehalfOf as Address;

  const data = encodeFunctionData({
    abi: POOL_ABI,
    functionName: "supply",
    args: [token.address, amountWei, onBehalfOf, 0],
  });

  const approval = buildApprovalTx(token.address, deployment.pool, amountWei, deployment.chainId);

  return buildResult(
    "supply",
    {
      protocol: params.protocol,
      chain: params.chain,
      asset: params.asset,
      amount: params.amount,
      amountWei: amountWei.toString(),
      pool: deployment.pool,
    },
    { to: deployment.pool, data, chainId: deployment.chainId },
    approval
  );
}

export async function handleLendingBorrow(params: {
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
  onBehalfOf: string;
}): Promise<Record<string, unknown>> {
  const deployment = resolvePool(params.protocol, params.chain);
  const token = resolveToken(params.asset, deployment);
  const amountWei = parseUnits(params.amount, token.decimals);
  const onBehalfOf = params.onBehalfOf as Address;

  // interestRateMode 2 = variable rate (stable rate deprecated in v3)
  const data = encodeFunctionData({
    abi: POOL_ABI,
    functionName: "borrow",
    args: [token.address, amountWei, 2n, 0, onBehalfOf],
  });

  return buildResult(
    "borrow",
    {
      protocol: params.protocol,
      chain: params.chain,
      asset: params.asset,
      amount: params.amount,
      amountWei: amountWei.toString(),
      interestRateMode: "variable",
      pool: deployment.pool,
    },
    { to: deployment.pool, data, chainId: deployment.chainId }
  );
}

export async function handleLendingWithdraw(params: {
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
  to: string;
}): Promise<Record<string, unknown>> {
  const deployment = resolvePool(params.protocol, params.chain);
  const token = resolveToken(params.asset, deployment);
  const toAddress = params.to as Address;

  const amountWei = params.amount === "max"
    ? UINT256_MAX
    : parseUnits(params.amount, token.decimals);

  const data = encodeFunctionData({
    abi: POOL_ABI,
    functionName: "withdraw",
    args: [token.address, amountWei, toAddress],
  });

  return buildResult(
    "withdraw",
    {
      protocol: params.protocol,
      chain: params.chain,
      asset: params.asset,
      amount: params.amount === "max" ? "max (all supplied)" : params.amount,
      pool: deployment.pool,
    },
    { to: deployment.pool, data, chainId: deployment.chainId }
  );
}

export async function handleLendingRepay(params: {
  protocol: string;
  chain: string;
  asset: string;
  amount: string;
  onBehalfOf: string;
}): Promise<Record<string, unknown>> {
  const deployment = resolvePool(params.protocol, params.chain);
  const token = resolveToken(params.asset, deployment);
  const onBehalfOf = params.onBehalfOf as Address;

  const amountWei = params.amount === "max"
    ? UINT256_MAX
    : parseUnits(params.amount, token.decimals);

  const data = encodeFunctionData({
    abi: POOL_ABI,
    functionName: "repay",
    args: [token.address, amountWei, 2n, onBehalfOf],
  });

  const approval = params.amount !== "max"
    ? buildApprovalTx(token.address, deployment.pool, amountWei, deployment.chainId)
    : buildApprovalTx(token.address, deployment.pool, UINT256_MAX, deployment.chainId);

  return buildResult(
    "repay",
    {
      protocol: params.protocol,
      chain: params.chain,
      asset: params.asset,
      amount: params.amount === "max" ? "max (all debt)" : params.amount,
      amountWei: amountWei.toString(),
      interestRateMode: "variable",
      pool: deployment.pool,
    },
    { to: deployment.pool, data, chainId: deployment.chainId },
    approval
  );
}
