import { formatUnits } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { MAKER, CACHE_TTL, RAY, type YieldOpportunity } from "./types.js";

const potAbi = [
  {
    name: "dsr",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "Pie",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "chi",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const erc20Abi = [
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Convert Maker's per-second rate (RAY) to annual percentage */
function dsrToAPY(dsrRay: bigint): number {
  const ratePerSecond = Number(dsrRay) / Number(RAY);
  const secondsPerYear = 365.25 * 24 * 60 * 60;
  return (Math.pow(ratePerSecond, secondsPerYear) - 1) * 100;
}

export async function getMakerDSRYield(): Promise<YieldOpportunity[]> {
  const cacheKey = "yield:maker-dsr";
  const cached = await cacheGet<YieldOpportunity[]>(cacheKey);
  if (cached) return cached;

  const client = getClient();

  const [dsr, pie, chi, sDaiSupply] = await Promise.all([
    client.readContract({ address: MAKER.pot, abi: potAbi, functionName: "dsr" }),
    client.readContract({ address: MAKER.pot, abi: potAbi, functionName: "Pie" }),
    client.readContract({ address: MAKER.pot, abi: potAbi, functionName: "chi" }),
    client.readContract({ address: MAKER.sDAI, abi: erc20Abi, functionName: "totalSupply" }),
  ]);

  const apy = dsrToAPY(dsr);
  const totalDaiInPot = Number(formatUnits(pie, 18)) * (Number(chi) / Number(RAY));
  const sDaiTotalSupply = Number(formatUnits(sDaiSupply, 18));

  const results: YieldOpportunity[] = [
    {
      protocol: "Maker / Sky",
      product: "Dai Savings Rate (sDAI)",
      asset: "DAI",
      apy,
      apyType: "variable",
      tvlUSD: totalDaiInPot,
      category: "savings-rate",
      risk: "low",
      riskNotes: "Maker governance-set rate. Smart contract risk is minimal — Pot is one of the oldest DeFi contracts. Rate can change via governance vote.",
      lockup: "none",
      lastUpdated: new Date().toISOString(),
    },
  ];

  await cacheSet(cacheKey, results, CACHE_TTL.yield);
  return results;
}
