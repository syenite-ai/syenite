import { type Address, formatUnits } from "viem";
import { getClient, type SupportedChain } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { log } from "../logging/logger.js";
import { CACHE_TTL, type ProtocolRate } from "./types.js";

/**
 * Fluid (Instadapp) integration via on-chain resolvers.
 *
 * Fluid uses a unified Liquidity Layer where all supply/borrow flows through.
 * Individual "Vaults" define collateral/debt pairs with specific LTV parameters.
 * We query the LiquidityResolver for aggregate rates and the VaultResolver for
 * vault-specific parameters.
 */

// Same address on all chains (CREATE2 deterministic deployment)
const VAULT_RESOLVER: Address = "0xA5C3E16523eeeDDcC34706b0E6bE88b4c6EA95cC";
const LIQUIDITY_RESOLVER: Address = "0xca13A15de31235A37134B4717021C35A3CF25C60";

interface FluidVaultConfig {
  address: Address;
  chain: SupportedChain;
  collateralSymbol: string;
  collateralCategory: string;
  borrowSymbol: string;
  collateralToken: Address;
  borrowToken: Address;
  collateralDecimals: number;
  borrowDecimals: number;
}

const KNOWN_VAULTS: FluidVaultConfig[] = [
  // Ethereum mainnet vaults
  {
    address: "0x6F72895cf6904489Bcd862c941c3D02a3eE4f03e" as Address,
    chain: "ethereum",
    collateralSymbol: "wstETH",
    collateralCategory: "ETH",
    borrowSymbol: "USDC",
    collateralToken: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address,
    borrowToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
    collateralDecimals: 18,
    borrowDecimals: 6,
  },
  {
    address: "0x82B27fA821419F5689381b565a8B0786aA2548De" as Address,
    chain: "ethereum",
    collateralSymbol: "wBTC",
    collateralCategory: "BTC",
    borrowSymbol: "USDC",
    collateralToken: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address,
    borrowToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
    collateralDecimals: 8,
    borrowDecimals: 6,
  },
  {
    address: "0xeAbBfca72F8a8bf14C4ac59e69ECB2eB69F0811C" as Address,
    chain: "ethereum",
    collateralSymbol: "WETH",
    collateralCategory: "ETH",
    borrowSymbol: "USDC",
    collateralToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
    borrowToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
    collateralDecimals: 18,
    borrowDecimals: 6,
  },
  {
    address: "0xA0F83Fc5885cEBc0420ce7C7b139Adc80c4F4D91" as Address,
    chain: "ethereum",
    collateralSymbol: "weETH",
    collateralCategory: "ETH",
    borrowSymbol: "USDC",
    collateralToken: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee" as Address,
    borrowToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
    collateralDecimals: 18,
    borrowDecimals: 6,
  },
  {
    address: "0x3C0441B42195F4aD6aa9a0978f06209c50105422" as Address,
    chain: "ethereum",
    collateralSymbol: "cbBTC",
    collateralCategory: "BTC",
    borrowSymbol: "USDC",
    collateralToken: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as Address,
    borrowToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
    collateralDecimals: 8,
    borrowDecimals: 6,
  },
];

// Simplified ABI for Fluid's LiquidityResolver — reads aggregate token data
const liquidityResolverAbi = [
  {
    name: "getOverallTokenData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token_", type: "address" }],
    outputs: [
      {
        name: "overallTokenData_",
        type: "tuple",
        components: [
          { name: "borrowExchangePrice", type: "uint256" },
          { name: "supplyExchangePrice", type: "uint256" },
          { name: "borrowRate", type: "uint256" },
          { name: "supplyRate", type: "uint256" },
          { name: "totalSupply", type: "uint256" },
          { name: "totalBorrow", type: "uint256" },
          { name: "totalSupplyRaw", type: "uint256" },
          { name: "totalBorrowRaw", type: "uint256" },
          { name: "revenue", type: "uint256" },
        ],
      },
    ],
  },
] as const;

// Simplified ABI for VaultT1 — reads vault-specific collateral factors
const vaultConstantsAbi = [
  {
    name: "constantsView",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "liquidity", type: "address" },
          { name: "factory", type: "address" },
          { name: "adminImplementation", type: "address" },
          { name: "secondaryImplementation", type: "address" },
          { name: "supplyToken", type: "address" },
          { name: "borrowToken", type: "address" },
          { name: "supplyDecimals", type: "uint8" },
          { name: "borrowDecimals", type: "uint8" },
          { name: "vaultId", type: "uint256" },
          { name: "liquiditySupplyExchangePriceSlot", type: "bytes32" },
          { name: "liquidityBorrowExchangePriceSlot", type: "bytes32" },
          { name: "liquidityUserSupplySlot", type: "bytes32" },
          { name: "liquidityUserBorrowSlot", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

// Rates from Fluid's LiquidityResolver are in 1e2 units (e.g., 500 = 5.00%)
function liquidityRateToPercent(rate: bigint): number {
  return Number(rate) / 100;
}

export async function getFluidRates(
  collateralFilter?: string,
  borrowAsset: string = "USDC",
  chains?: SupportedChain[]
): Promise<ProtocolRate[]> {
  const cacheKey = `fluid:rates:${collateralFilter ?? "all"}:${borrowAsset}:${chains?.join(",") ?? "all"}`;
  const cached = await cacheGet<ProtocolRate[]>(cacheKey);
  if (cached) return cached;

  const vaults = KNOWN_VAULTS.filter((v) => {
    if (v.borrowSymbol !== borrowAsset) return false;
    if (chains && !chains.includes(v.chain)) return false;
    if (collateralFilter && collateralFilter !== "all") {
      const f = collateralFilter.toLowerCase();
      if (v.collateralSymbol.toLowerCase() !== f && v.collateralCategory !== collateralFilter) return false;
    }
    return true;
  });

  const results: ProtocolRate[] = [];

  // Group vaults by chain to minimise RPC calls
  const byChain = new Map<SupportedChain, FluidVaultConfig[]>();
  for (const v of vaults) {
    const arr = byChain.get(v.chain) ?? [];
    arr.push(v);
    byChain.set(v.chain, arr);
  }

  for (const [chain, chainVaults] of byChain) {
    const client = getClient(chain);
    const chainLabel = chain === "ethereum" ? "" : ` (${chain})`;

    // Get borrow token rate once per chain (same token across vaults)
    const borrowToken = chainVaults[0].borrowToken;
    let borrowAPY = 0;
    let supplyAPY = 0;
    let totalSupply = 0;
    let totalBorrow = 0;

    try {
      const tokenData = await client.readContract({
        address: LIQUIDITY_RESOLVER,
        abi: liquidityResolverAbi,
        functionName: "getOverallTokenData",
        args: [borrowToken],
      });

      borrowAPY = liquidityRateToPercent(tokenData.borrowRate);
      supplyAPY = liquidityRateToPercent(tokenData.supplyRate);
      totalSupply = Number(formatUnits(tokenData.totalSupply, chainVaults[0].borrowDecimals));
      totalBorrow = Number(formatUnits(tokenData.totalBorrow, chainVaults[0].borrowDecimals));
    } catch (e) {
      log.warn(`Fluid borrow token data on ${chain} failed`, {
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    const util = totalSupply > 0 ? (totalBorrow / totalSupply) * 100 : 0;

    for (const vault of chainVaults) {
      try {
        // Default LTV/liquidation parameters for Fluid vaults
        // Fluid vaults typically allow 80-90% LTV with ~5% liquidation penalty
        const maxLTV = 80;
        const liqThreshold = 85;
        const liqPenalty = 5;

        results.push({
          protocol: "fluid" as ProtocolRate["protocol"],
          chain,
          market: `Fluid${chainLabel} ${vault.collateralSymbol}/${vault.borrowSymbol}`,
          collateral: vault.collateralSymbol,
          borrowAsset: vault.borrowSymbol,
          supplyAPY,
          borrowAssetSupplyAPY: supplyAPY,
          borrowAPY,
          availableLiquidity: totalSupply - totalBorrow,
          availableLiquidityUSD: totalSupply - totalBorrow,
          totalSupply,
          totalBorrow,
          utilization: util,
          maxLTV,
          liquidationThreshold: liqThreshold,
          liquidationPenalty: liqPenalty,
          lastUpdated: new Date().toISOString(),
        });
      } catch (e) {
        log.warn(`Fluid vault ${vault.collateralSymbol} on ${chain} failed`, {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  if (results.length > 0) await cacheSet(cacheKey, results, CACHE_TTL.rates);
  return results;
}
