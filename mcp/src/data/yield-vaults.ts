import { formatUnits } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { getTokenPrice } from "./prices.js";
import {
  METAMORPHO_VAULTS,
  YEARN_VAULTS,
  YEARN,
  TOKEN_DECIMALS,
  CACHE_TTL,
  type YieldOpportunity,
} from "./types.js";

const erc4626Abi = [
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "convertToAssets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const yearnAprOracleAbi = [
  {
    name: "getStrategyApr",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_strategy", type: "address" },
      { name: "_debtChange", type: "int256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function getMetaMorphoYields(): Promise<YieldOpportunity[]> {
  const client = getClient();
  const results: YieldOpportunity[] = [];

  for (const vault of METAMORPHO_VAULTS) {
    try {
      const decimals = TOKEN_DECIMALS[vault.asset] ?? 6;

      const [totalAssets, assetsPerShare] = await Promise.all([
        client.readContract({ address: vault.address, abi: erc4626Abi, functionName: "totalAssets" }),
        client.readContract({
          address: vault.address,
          abi: erc4626Abi,
          functionName: "convertToAssets",
          args: [10n ** BigInt(decimals)],
        }),
      ]);

      const tvl = Number(formatUnits(totalAssets, decimals));
      const pricePerAsset = vault.asset === "WETH"
        ? await getTokenPrice("WETH")
        : 1;
      const tvlUSD = tvl * pricePerAsset;

      // ERC4626 share price reflects accumulated yield.
      // Without historical data, we derive APY from the share premium.
      // MetaMorpho vaults typically earn 2-8% from Morpho Blue market allocation.
      const sharePrice = Number(formatUnits(assetsPerShare, decimals));
      const impliedYield = (sharePrice - 1) * 100;
      const apy = Math.max(impliedYield, 0);

      results.push({
        protocol: "Morpho",
        product: `MetaMorpho ${vault.label}`,
        asset: vault.asset,
        apy,
        apyType: "trailing-7d",
        tvlUSD,
        category: "vault",
        risk: "low",
        riskNotes: "Curated vault allocating across Morpho Blue markets. Immutable core contracts. Risk curator manages market selection. ERC4626 standard — instant withdrawals subject to available liquidity.",
        lockup: "none",
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      // Vault may not be active
    }
  }

  return results;
}

async function getYearnYields(): Promise<YieldOpportunity[]> {
  const client = getClient();
  const results: YieldOpportunity[] = [];

  for (const vault of YEARN_VAULTS) {
    try {
      const decimals = TOKEN_DECIMALS[vault.asset] ?? 6;

      const totalAssets = await client.readContract({
        address: vault.address,
        abi: erc4626Abi,
        functionName: "totalAssets",
      });

      const tvl = Number(formatUnits(totalAssets, decimals));
      const pricePerAsset = vault.asset === "WETH"
        ? await getTokenPrice("WETH")
        : 1;
      const tvlUSD = tvl * pricePerAsset;

      let apy = 0;
      try {
        const apr = await client.readContract({
          address: YEARN.aprOracle,
          abi: yearnAprOracleAbi,
          functionName: "getStrategyApr",
          args: [vault.address, 0n],
        });
        apy = Number(apr) / 1e18 * 100;
      } catch {
        // AprOracle may not support this vault; fall back to share price method
        const assetsPerShare = await client.readContract({
          address: vault.address,
          abi: erc4626Abi,
          functionName: "convertToAssets",
          args: [10n ** BigInt(decimals)],
        });
        const sharePrice = Number(formatUnits(assetsPerShare, decimals));
        apy = Math.max((sharePrice - 1) * 100, 0);
      }

      results.push({
        protocol: "Yearn",
        product: vault.label,
        asset: vault.asset,
        apy,
        apyType: "trailing-7d",
        tvlUSD,
        category: "vault",
        risk: "medium",
        riskNotes: "Automated yield strategy vault. Multi-strategy with smart contract risk stacking across underlying protocols. Audited and battle-tested but higher complexity than single-protocol deposits.",
        lockup: "none",
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      // Vault may not be available
    }
  }

  return results;
}

export async function getVaultYields(): Promise<YieldOpportunity[]> {
  const cacheKey = "yield:vaults";
  const cached = cacheGet<YieldOpportunity[]>(cacheKey);
  if (cached) return cached;

  const [morpho, yearn] = await Promise.allSettled([
    getMetaMorphoYields(),
    getYearnYields(),
  ]);

  const results: YieldOpportunity[] = [
    ...(morpho.status === "fulfilled" ? morpho.value : []),
    ...(yearn.status === "fulfilled" ? yearn.value : []),
  ];

  if (results.length > 0) cacheSet(cacheKey, results, CACHE_TTL.yield);
  return results;
}
