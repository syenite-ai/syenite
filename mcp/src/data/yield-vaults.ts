import { formatUnits } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { recordSnapshot, getTrailingAPY } from "./snapshots.js";
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

async function fetchMetaMorphoVault(
  vault: (typeof METAMORPHO_VAULTS)[number],
  client: ReturnType<typeof getClient>
): Promise<YieldOpportunity> {
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
  const pricePerAsset = vault.asset === "WETH" ? await getTokenPrice("WETH") : 1;
  const tvlUSD = tvl * pricePerAsset;

  const sharePrice = Number(formatUnits(assetsPerShare, decimals));
  const snapshotKey = `share:metamorpho:${vault.address.toLowerCase()}`;
  await recordSnapshot(snapshotKey, sharePrice);
  const trailingAPY = await getTrailingAPY(snapshotKey, 7);

  const apy = trailingAPY ?? 0;
  const apyType = trailingAPY !== null ? "trailing-7d" as const : "estimated" as const;

  return {
    protocol: "Morpho",
    product: `MetaMorpho ${vault.label}`,
    asset: vault.asset,
    apy,
    apyType,
    tvlUSD,
    category: "vault",
    risk: "low",
    riskNotes: "Curated vault allocating across Morpho Blue markets. Immutable core contracts. Risk curator manages market selection. ERC4626 standard — instant withdrawals subject to available liquidity.",
    lockup: "none",
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchYearnVault(
  vault: (typeof YEARN_VAULTS)[number],
  client: ReturnType<typeof getClient>
): Promise<YieldOpportunity> {
  const decimals = TOKEN_DECIMALS[vault.asset] ?? 6;

  const totalAssets = await client.readContract({
    address: vault.address,
    abi: erc4626Abi,
    functionName: "totalAssets",
  });

  const tvl = Number(formatUnits(totalAssets, decimals));
  const pricePerAsset = vault.asset === "WETH" ? await getTokenPrice("WETH") : 1;
  const tvlUSD = tvl * pricePerAsset;

  let apy = 0;
  let apyType: "variable" | "trailing-7d" | "estimated" = "estimated";

  try {
    const apr = await client.readContract({
      address: YEARN.aprOracle,
      abi: yearnAprOracleAbi,
      functionName: "getStrategyApr",
      args: [vault.address, 0n],
    });
    apy = Number(apr) / 1e18 * 100;
    apyType = "variable";
  } catch (e) {
    console.warn(`[syenite] Yearn AprOracle for ${vault.label} failed, falling back to share price:`, e instanceof Error ? e.message : e);
    const assetsPerShare = await client.readContract({
      address: vault.address,
      abi: erc4626Abi,
      functionName: "convertToAssets",
      args: [10n ** BigInt(decimals)],
    });
    const sharePrice = Number(formatUnits(assetsPerShare, decimals));
    const snapshotKey = `share:yearn:${vault.address.toLowerCase()}`;
    await recordSnapshot(snapshotKey, sharePrice);
    const trailingAPY = await getTrailingAPY(snapshotKey, 7);
    apy = trailingAPY ?? 0;
    apyType = trailingAPY !== null ? "trailing-7d" : "estimated";
  }

  return {
    protocol: "Yearn",
    product: vault.label,
    asset: vault.asset,
    apy,
    apyType,
    tvlUSD,
    category: "vault",
    risk: "medium",
    riskNotes: "Automated yield strategy vault. Multi-strategy with smart contract risk stacking across underlying protocols. Audited and battle-tested but higher complexity than single-protocol deposits.",
    lockup: "none",
    lastUpdated: new Date().toISOString(),
  };
}

export async function getVaultYields(): Promise<YieldOpportunity[]> {
  const cacheKey = "yield:vaults";
  const cached = await cacheGet<YieldOpportunity[]>(cacheKey);
  if (cached) return cached;

  const client = getClient();

  const [morphoResults, yearnResults] = await Promise.all([
    Promise.allSettled(METAMORPHO_VAULTS.map((v) => fetchMetaMorphoVault(v, client))),
    Promise.allSettled(YEARN_VAULTS.map((v) => fetchYearnVault(v, client))),
  ]);

  const results: YieldOpportunity[] = [
    ...morphoResults.filter((r): r is PromiseFulfilledResult<YieldOpportunity> => r.status === "fulfilled").map((r) => r.value),
    ...yearnResults.filter((r): r is PromiseFulfilledResult<YieldOpportunity> => r.status === "fulfilled").map((r) => r.value),
  ];

  if (results.length > 0) await cacheSet(cacheKey, results, CACHE_TTL.yield);
  return results;
}
