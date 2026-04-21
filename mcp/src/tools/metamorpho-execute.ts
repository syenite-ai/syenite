import { type Address, encodeFunctionData, getAddress, parseUnits } from "viem";
import { getAllMetaMorphoVaults } from "../data/morpho.js";
import { CHAIN_IDS, TOKEN_DECIMALS, type VaultData } from "../data/types.js";
import { SyeniteError } from "../errors.js";

export const metaMorphoSupplyToolName = "metamorpho.supply";
export const metaMorphoWithdrawToolName = "metamorpho.withdraw";

export const metaMorphoSupplyDescription = `Builds unsigned ERC-20 approval and ERC-4626 deposit transaction calldata for supplying assets into a MetaMorpho curated vault on Ethereum, Base, Arbitrum, or Optimism.
Call this after selecting a vault from \`yield.opportunities\` (category "vault") or \`yield.assess\`; use \`vault\` to target by vault address or a name/curator fragment (e.g. "Steakhouse", "Gauntlet").
Provide \`vault\` identifier, human-readable \`amount\`, and \`receiver\` wallet address; the tool resolves vault address, underlying asset, and decimals automatically and errors with suggestions if the vault name is ambiguous.
Returns the ERC-20 approval transaction (submit first) and the deposit transaction; shares are credited to \`receiver\` at the vault's current exchange rate.
Syenite never holds private keys; no funds move until the caller signs and broadcasts both transactions.`;

export const metaMorphoWithdrawDescription = `Builds an unsigned ERC-4626 redeem transaction calldata to withdraw assets from a MetaMorpho vault on Ethereum, Base, Arbitrum, or Optimism.
Call this when an agent needs to exit a MetaMorpho vault position; no approval transaction is required for redemption.
Provide \`vault\` identifier (address or name fragment), \`shares\` as a human-readable amount or the string "max" to redeem the full balance, \`receiver\` address to receive underlying assets, and \`owner\` address whose shares will be burned.
Returns the redeem transaction request; withdrawal is subject to available liquidity in the underlying Morpho Blue markets and Syenite never holds private keys.`;

const erc4626Abi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "redeem",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    name: "asset",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

function tryAddress(x: string): Address | null {
  try {
    return getAddress(x);
  } catch {
    return null;
  }
}

async function findVault(vault: string): Promise<VaultData> {
  const candidate = tryAddress(vault);
  const vaults = await getAllMetaMorphoVaults();
  if (candidate) {
    const hit = vaults.find((v) => v.address.toLowerCase() === candidate.toLowerCase());
    if (hit) return hit;
  }
  const lower = vault.toLowerCase();
  const matches = vaults.filter(
    (v) =>
      v.name.toLowerCase().includes(lower) ||
      v.curator.toLowerCase().includes(lower) ||
      v.address.toLowerCase() === lower
  );
  if (matches.length === 0) {
    throw SyeniteError.notFound(
      `No MetaMorpho vault matches "${vault}". Use yield.opportunities with category="vault" to see available vaults.`
    );
  }
  if (matches.length > 1 && !candidate) {
    const names = matches.slice(0, 5).map((m) => `${m.name} (${m.chain})`).join("; ");
    throw SyeniteError.invalidInput(
      `Ambiguous vault "${vault}" — matches ${matches.length}: ${names}. Pass a vault address or a more specific name fragment.`
    );
  }
  return matches[0];
}

function decimalsFor(asset: string): number {
  return TOKEN_DECIMALS[asset] ?? (asset === "USDC" || asset === "USDT" ? 6 : 18);
}

export interface LendingSupplyParams {
  vault: string;
  amount: string;
  receiver: string;
}

export async function handleMetaMorphoSupply(params: LendingSupplyParams): Promise<Record<string, unknown>> {
  const receiver = tryAddress(params.receiver);
  if (!receiver) throw SyeniteError.invalidInput(`Invalid receiver address: ${params.receiver}`);
  const vault = await findVault(params.vault);
  const decimals = decimalsFor(vault.asset);
  const assetsRaw = parseUnits(params.amount, decimals);
  const chainId = CHAIN_IDS[vault.chain];
  if (!chainId) {
    throw SyeniteError.invalidInput(`No chain ID mapping for ${vault.chain}`);
  }

  const data = encodeFunctionData({
    abi: erc4626Abi,
    functionName: "deposit",
    args: [assetsRaw, receiver],
  });

  return {
    protocol: "morpho",
    product: `MetaMorpho ${vault.name}`,
    chain: vault.chain,
    vault: {
      address: vault.address,
      name: vault.name,
      curator: vault.curator,
      asset: vault.asset,
    },
    amount: { human: params.amount, raw: assetsRaw.toString(), decimals },
    transactionRequest: {
      to: vault.address,
      data,
      value: "0",
      gasLimit: "350000",
      chainId,
    },
    approvalRequired: {
      note: `Approve the vault to spend ${params.amount} ${vault.asset} before calling deposit().`,
      tokenSymbol: vault.asset,
      spender: vault.address,
      amount: assetsRaw.toString(),
    },
    timestamp: new Date().toISOString(),
    note: "ERC-4626 deposit. Shares credited to receiver. Supply APY variable — tracks underlying Morpho Blue markets.",
  };
}

export interface LendingWithdrawParams {
  vault: string;
  shares: string;
  receiver: string;
  owner: string;
}

export async function handleMetaMorphoWithdraw(params: LendingWithdrawParams): Promise<Record<string, unknown>> {
  const receiver = tryAddress(params.receiver);
  const owner = tryAddress(params.owner);
  if (!receiver) throw SyeniteError.invalidInput(`Invalid receiver: ${params.receiver}`);
  if (!owner) throw SyeniteError.invalidInput(`Invalid owner: ${params.owner}`);
  const vault = await findVault(params.vault);
  const chainId = CHAIN_IDS[vault.chain];
  if (!chainId) {
    throw SyeniteError.invalidInput(`No chain ID mapping for ${vault.chain}`);
  }

  // Vault shares use the vault's own decimals (convention: same as underlying).
  const decimals = decimalsFor(vault.asset);
  const sharesRaw =
    params.shares === "max" ? 2n ** 256n - 1n : parseUnits(params.shares, decimals);

  const data = encodeFunctionData({
    abi: erc4626Abi,
    functionName: "redeem",
    args: [sharesRaw, receiver, owner],
  });

  return {
    protocol: "morpho",
    product: `MetaMorpho ${vault.name}`,
    chain: vault.chain,
    vault: {
      address: vault.address,
      name: vault.name,
      curator: vault.curator,
      asset: vault.asset,
    },
    shares: { human: params.shares, raw: sharesRaw.toString(), decimals },
    transactionRequest: {
      to: vault.address,
      data,
      value: "0",
      gasLimit: "400000",
      chainId,
    },
    timestamp: new Date().toISOString(),
    note: "ERC-4626 redeem. Shares burned; underlying asset delivered to receiver. Subject to available liquidity in underlying Morpho Blue markets.",
  };
}
