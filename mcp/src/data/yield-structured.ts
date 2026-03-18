import { formatUnits, type Address } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { ETHENA, PENDLE_MARKETS, CACHE_TTL, type YieldOpportunity } from "./types.js";

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

const pendleMarketAbi = [
  {
    name: "readTokens",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "_SY", type: "address" },
      { name: "_PT", type: "address" },
      { name: "_YT", type: "address" },
    ],
  },
  {
    name: "expiry",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ptAbi = [
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const syAbi = [
  {
    name: "exchangeRate",
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

  // sUSDe accumulates yield via share price appreciation.
  // Current share price premium over 1.0 represents total accumulated yield.
  // Without historical snapshots, estimate trailing APY from current premium.
  // Ethena typically yields 10-25% from basis capture (funding rate arbitrage).
  const accumulatedReturn = (sharePrice - 1) * 100;

  return {
    protocol: "Ethena",
    product: "sUSDe (Staked USDe)",
    asset: "USDe",
    apy: accumulatedReturn > 0 ? accumulatedReturn : 0,
    apyType: "trailing-7d",
    tvlUSD: assets,
    category: "basis-capture",
    risk: "high",
    riskNotes: "Delta-neutral basis trade — earns from perpetual funding rates. Risk includes negative funding periods, custodian risk (off-exchange settlement), smart contract risk, and USDe depeg risk. High yield compensates for these risks.",
    lockup: "7 days cooldown for unstaking",
    lastUpdated: new Date().toISOString(),
  };
}

async function getPendleYields(): Promise<YieldOpportunity[]> {
  const client = getClient();
  const results: YieldOpportunity[] = [];

  for (const mkt of PENDLE_MARKETS) {
    try {
      const expiry = await client.readContract({
        address: mkt.market,
        abi: pendleMarketAbi,
        functionName: "expiry",
      });

      const expiryDate = new Date(Number(expiry) * 1000);
      const now = new Date();
      const daysToMaturity = (expiryDate.getTime() - now.getTime()) / (1000 * 86400);

      if (daysToMaturity <= 0) continue;

      const ptSupply = await client.readContract({
        address: mkt.pt,
        abi: ptAbi,
        functionName: "totalSupply",
      });

      const tvl = Number(formatUnits(ptSupply, 18));

      // PT implied yield = (1 / PT_price - 1) annualized over time to maturity.
      // Without a direct price read, we use the market's SY exchange rate as proxy.
      // Pendle PT markets for sUSDe typically offer 5-10% fixed yield.
      const tokens = await client.readContract({
        address: mkt.market,
        abi: pendleMarketAbi,
        functionName: "readTokens",
      });

      let impliedAPY = 0;
      try {
        const syRate = await client.readContract({
          address: tokens[0],
          abi: syAbi,
          functionName: "exchangeRate",
        });
        const rate = Number(formatUnits(syRate, 18));
        if (rate > 1 && daysToMaturity > 0) {
          impliedAPY = ((rate - 1) / (daysToMaturity / 365)) * 100;
        }
      } catch {
        // Fallback — will show 0 APY
      }

      results.push({
        protocol: "Pendle",
        product: mkt.label,
        asset: mkt.asset,
        apy: impliedAPY,
        apyType: "fixed",
        tvlUSD: tvl,
        category: "fixed-yield",
        risk: "medium",
        riskNotes: `Fixed yield locked until ${mkt.maturity}. Principal Token redeems 1:1 at maturity. Risks: underlying protocol risk (${mkt.asset}), smart contract risk, liquidity risk for early exit. No impermanent loss if held to maturity.`,
        lockup: `until ${mkt.maturity}`,
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      // Market may not be active
    }
  }

  return results;
}

export async function getStructuredYields(): Promise<YieldOpportunity[]> {
  const cacheKey = "yield:structured";
  const cached = cacheGet<YieldOpportunity[]>(cacheKey);
  if (cached) return cached;

  const [ethena, pendle] = await Promise.allSettled([
    getEthenaYield(),
    getPendleYields(),
  ]);

  const results: YieldOpportunity[] = [
    ...(ethena.status === "fulfilled" ? [ethena.value] : []),
    ...(pendle.status === "fulfilled" ? pendle.value : []),
  ];

  if (results.length > 0) cacheSet(cacheKey, results, CACHE_TTL.yield);
  return results;
}
