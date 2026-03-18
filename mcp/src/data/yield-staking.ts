import { formatUnits } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { recordSnapshot, getTrailingAPY } from "./snapshots.js";
import { getTokenPrice } from "./prices.js";
import { LIDO, ROCKET_POOL, COINBASE, CACHE_TTL, type YieldOpportunity } from "./types.js";

const stETHAbi = [
  {
    name: "getTotalPooledEther",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getTotalShares",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "totalFee", type: "uint16" }],
  },
] as const;

const wstETHAbi = [
  {
    name: "stEthPerToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const rETHAbi = [
  {
    name: "getExchangeRate",
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

const cbETHAbi = [
  {
    name: "exchangeRate",
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

async function getLidoYield(client: ReturnType<typeof getClient>): Promise<YieldOpportunity> {
  const [totalPooledEther, , fee, stEthPerWstETH] = await Promise.all([
    client.readContract({ address: LIDO.stETH, abi: stETHAbi, functionName: "getTotalPooledEther" }),
    client.readContract({ address: LIDO.stETH, abi: stETHAbi, functionName: "getTotalShares" }),
    client.readContract({ address: LIDO.stETH, abi: stETHAbi, functionName: "getFee" }),
    client.readContract({ address: LIDO.wstETH, abi: wstETHAbi, functionName: "stEthPerToken" }),
  ]);

  const tvlETH = Number(formatUnits(totalPooledEther, 18));
  const ethPrice = await getTokenPrice("WETH");
  const tvlUSD = tvlETH * ethPrice;
  const feePercent = Number(fee) / 10000;

  const rate = Number(formatUnits(stEthPerWstETH, 18));
  recordSnapshot("rate:lido:wsteth", rate);
  const trailingAPY = getTrailingAPY("rate:lido:wsteth", 7);

  const apy = trailingAPY ?? 3.2 * (1 - feePercent);
  const apyType = trailingAPY !== null ? "trailing-7d" as const : "estimated" as const;

  return {
    protocol: "Lido",
    product: "ETH Staking (stETH / wstETH)",
    asset: "ETH",
    apy,
    apyType,
    tvlUSD,
    category: "liquid-staking",
    risk: "low",
    riskNotes: "Largest liquid staking protocol. ~30% of all staked ETH. Slight depeg possible in extreme conditions but deep secondary market liquidity. Slashing risk minimal with diversified validator set.",
    lockup: "none (liquid via stETH/wstETH)",
    lastUpdated: new Date().toISOString(),
  };
}

async function getRocketPoolYield(client: ReturnType<typeof getClient>): Promise<YieldOpportunity> {
  const [exchangeRate, totalSupply] = await Promise.all([
    client.readContract({ address: ROCKET_POOL.rETH, abi: rETHAbi, functionName: "getExchangeRate" }),
    client.readContract({ address: ROCKET_POOL.rETH, abi: rETHAbi, functionName: "totalSupply" }),
  ]);

  const rETHSupply = Number(formatUnits(totalSupply, 18));
  const rate = Number(formatUnits(exchangeRate, 18));
  const tvlETH = rETHSupply * rate;
  const ethPrice = await getTokenPrice("WETH");
  const tvlUSD = tvlETH * ethPrice;

  recordSnapshot("rate:rocketpool:reth", rate);
  const trailingAPY = getTrailingAPY("rate:rocketpool:reth", 7);

  const apy = trailingAPY ?? 2.8;
  const apyType = trailingAPY !== null ? "trailing-7d" as const : "estimated" as const;

  return {
    protocol: "Rocket Pool",
    product: "ETH Staking (rETH)",
    asset: "ETH",
    apy,
    apyType,
    tvlUSD,
    category: "liquid-staking",
    risk: "low",
    riskNotes: "Decentralized staking — permissionless node operators. rETH trades at premium/discount to NAV. Smaller validator set than Lido but more decentralized.",
    lockup: "none (liquid via rETH)",
    lastUpdated: new Date().toISOString(),
  };
}

async function getCbETHYield(client: ReturnType<typeof getClient>): Promise<YieldOpportunity> {
  const [exchangeRate, totalSupply] = await Promise.all([
    client.readContract({ address: COINBASE.cbETH, abi: cbETHAbi, functionName: "exchangeRate" }),
    client.readContract({ address: COINBASE.cbETH, abi: cbETHAbi, functionName: "totalSupply" }),
  ]);

  const cbETHSupply = Number(formatUnits(totalSupply, 18));
  const rate = Number(formatUnits(exchangeRate, 18));
  const tvlETH = cbETHSupply * rate;
  const ethPrice = await getTokenPrice("WETH");
  const tvlUSD = tvlETH * ethPrice;

  recordSnapshot("rate:coinbase:cbeth", rate);
  const trailingAPY = getTrailingAPY("rate:coinbase:cbeth", 7);

  const apy = trailingAPY ?? 2.5;
  const apyType = trailingAPY !== null ? "trailing-7d" as const : "estimated" as const;

  return {
    protocol: "Coinbase",
    product: "ETH Staking (cbETH)",
    asset: "ETH",
    apy,
    apyType,
    tvlUSD,
    category: "liquid-staking",
    risk: "low",
    riskNotes: "Coinbase-operated staking. Centralized operator risk but strong institutional backing and regulatory compliance. Higher commission than decentralized alternatives.",
    lockup: "none (liquid via cbETH)",
    lastUpdated: new Date().toISOString(),
  };
}

export async function getStakingYields(): Promise<YieldOpportunity[]> {
  const cacheKey = "yield:staking";
  const cached = cacheGet<YieldOpportunity[]>(cacheKey);
  if (cached) return cached;

  const client = getClient();

  const [lido, rocketPool, cbETH] = await Promise.allSettled([
    getLidoYield(client),
    getRocketPoolYield(client),
    getCbETHYield(client),
  ]);

  const results: YieldOpportunity[] = [
    ...(lido.status === "fulfilled" ? [lido.value] : []),
    ...(rocketPool.status === "fulfilled" ? [rocketPool.value] : []),
    ...(cbETH.status === "fulfilled" ? [cbETH.value] : []),
  ];

  if (results.length > 0) cacheSet(cacheKey, results, CACHE_TTL.yield);
  return results;
}
