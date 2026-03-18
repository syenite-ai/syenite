import { formatUnits } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
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

/**
 * Lido stETH staking APR.
 * Uses total pooled ether and shares to derive the staking rate.
 * Lido reports ~3-3.5% APR for ETH consensus + execution rewards minus protocol fee.
 * Since on-chain APR requires historical data, we approximate from the known
 * Ethereum staking baseline (~3.5%) minus Lido's 10% fee.
 */
async function getLidoYield(client: ReturnType<typeof getClient>): Promise<YieldOpportunity> {
  const [totalPooledEther, totalShares, fee] = await Promise.all([
    client.readContract({ address: LIDO.stETH, abi: stETHAbi, functionName: "getTotalPooledEther" }),
    client.readContract({ address: LIDO.stETH, abi: stETHAbi, functionName: "getTotalShares" }),
    client.readContract({ address: LIDO.stETH, abi: stETHAbi, functionName: "getFee" }),
  ]);

  const tvlETH = Number(formatUnits(totalPooledEther, 18));
  const ethPrice = await getTokenPrice("WETH");
  const tvlUSD = tvlETH * ethPrice;
  const feePercent = Number(fee) / 10000;

  // Ethereum consensus yield baseline ~3.5% APR, Lido takes 10% of rewards
  const baseStakingAPR = 3.5;
  const apy = baseStakingAPR * (1 - feePercent);

  return {
    protocol: "Lido",
    product: "ETH Staking (stETH / wstETH)",
    asset: "ETH",
    apy,
    apyType: "variable",
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

  // Rocket Pool takes 14% commission (5% node operator, 9% protocol/node)
  const baseStakingAPR = 3.5;
  const apy = baseStakingAPR * 0.86;

  return {
    protocol: "Rocket Pool",
    product: "ETH Staking (rETH)",
    asset: "ETH",
    apy,
    apyType: "variable",
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

  // Coinbase takes ~25% commission
  const baseStakingAPR = 3.5;
  const apy = baseStakingAPR * 0.75;

  return {
    protocol: "Coinbase",
    product: "ETH Staking (cbETH)",
    asset: "ETH",
    apy,
    apyType: "variable",
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
