import { formatUnits } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { recordSnapshot, getTrailingAPY } from "./snapshots.js";
import { ETHENA, CACHE_TTL, type YieldOpportunity } from "./types.js";

const sUSDeAbi = [
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function getEthenaYield(): Promise<YieldOpportunity> {
  const client = getClient();

  const [totalAssets, totalSupply] = await Promise.all([
    client.readContract({ address: ETHENA.sUSDe, abi: sUSDeAbi, functionName: "totalAssets" }),
    client.readContract({ address: ETHENA.sUSDe, abi: sUSDeAbi, functionName: "totalSupply" }),
  ]);

  const assets = Number(formatUnits(totalAssets, 18));
  const supply = Number(formatUnits(totalSupply, 18));
  const sharePrice = supply > 0 ? assets / supply : 1;

  const snapshotKey = "share:ethena:susde";
  await recordSnapshot(snapshotKey, sharePrice);
  const trailingAPY = await getTrailingAPY(snapshotKey, 7);

  const apy = trailingAPY ?? 0;
  const apyType = trailingAPY !== null ? "trailing-7d" as const : "estimated" as const;

  return {
    protocol: "Ethena",
    product: "sUSDe (Staked USDe)",
    asset: "USDe",
    apy,
    apyType,
    tvlUSD: assets,
    category: "basis-capture",
    risk: "high",
    riskNotes: "Delta-neutral basis trade — earns from perpetual funding rates. Risk includes negative funding periods, custodian risk (off-exchange settlement), smart contract risk, and USDe depeg risk. High yield compensates for these risks.",
    lockup: "7 days cooldown for unstaking",
    lastUpdated: new Date().toISOString(),
  };
}

// Pendle PT markets are deprecated pending updated market addresses.
// See yield-structured.ts history for prior Pendle implementation.

export async function getStructuredYields(): Promise<YieldOpportunity[]> {
  const cacheKey = "yield:structured";
  const cached = await cacheGet<YieldOpportunity[]>(cacheKey);
  if (cached) return cached;

  const [ethena] = await Promise.allSettled([getEthenaYield()]);

  const results: YieldOpportunity[] = [
    ...(ethena.status === "fulfilled" ? [ethena.value] : []),
  ];

  if (results.length > 0) await cacheSet(cacheKey, results, CACHE_TTL.yield);
  return results;
}
