import { type Address, formatUnits } from "viem";
import { getClient, type SupportedChain } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { log } from "../logging/logger.js";
import { CACHE_TTL, type ProtocolRate, type PositionData } from "./types.js";
import { getTokenPrice } from "./prices.js";

// Compound V3 "Comet" — each deployment is a single-borrow-asset market with multiple collaterals

interface CometDeployment {
  chain: SupportedChain;
  comet: Address;
  borrowAsset: string;
  borrowDecimals: number;
  collaterals: Array<{ symbol: string; address: Address; decimals: number; category: string }>;
}

const COMET_DEPLOYMENTS: CometDeployment[] = [
  {
    chain: "ethereum",
    comet: "0xc3d688B66703497DAA19211EEdff47f25384cdc3" as Address,
    borrowAsset: "USDC",
    borrowDecimals: 6,
    collaterals: [
      { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address, decimals: 18, category: "ETH" },
      { symbol: "wBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address, decimals: 8, category: "BTC" },
      { symbol: "cbETH", address: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704" as Address, decimals: 18, category: "ETH" },
      { symbol: "wstETH", address: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address, decimals: 18, category: "ETH" },
    ],
  },
  {
    chain: "arbitrum",
    comet: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf" as Address,
    borrowAsset: "USDC",
    borrowDecimals: 6,
    collaterals: [
      { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as Address, decimals: 18, category: "ETH" },
      { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" as Address, decimals: 8, category: "BTC" },
    ],
  },
  {
    chain: "base",
    comet: "0xb125E6687d4313864e53df431d5425969c15Eb2F" as Address,
    borrowAsset: "USDC",
    borrowDecimals: 6,
    collaterals: [
      { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" as Address, decimals: 18, category: "ETH" },
      { symbol: "cbETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22" as Address, decimals: 18, category: "ETH" },
    ],
  },
];

const cometAbi = [
  {
    name: "getUtilization",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getSupplyRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint256" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "getBorrowRate",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "utilization", type: "uint256" }],
    outputs: [{ name: "", type: "uint64" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalBorrow",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAssetInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "i", type: "uint8" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "offset", type: "uint8" },
          { name: "asset", type: "address" },
          { name: "priceFeed", type: "address" },
          { name: "scale", type: "uint64" },
          { name: "borrowCollateralFactor", type: "uint64" },
          { name: "liquidateCollateralFactor", type: "uint64" },
          { name: "liquidationFactor", type: "uint64" },
          { name: "supplyCap", type: "uint128" },
        ],
      },
    ],
  },
  {
    name: "numAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "borrowBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "collateralBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "uint128" }],
  },
] as const;

const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
const FACTOR_SCALE = 1e18;

function ratePerSecondToAPY(ratePerSecond: bigint): number {
  const rate = Number(ratePerSecond) / 1e18;
  return (Math.pow(1 + rate, SECONDS_PER_YEAR) - 1) * 100;
}

async function getCompoundRatesForDeployment(
  deployment: CometDeployment,
  collateralFilter?: string,
): Promise<ProtocolRate[]> {
  const cacheKey = `compound-v3:${deployment.chain}:rates:${collateralFilter ?? "all"}:${deployment.borrowAsset}`;
  const cached = await cacheGet<ProtocolRate[]>(cacheKey);
  if (cached) return cached;

  const client = getClient(deployment.chain);

  const [utilization, totalSupplyRaw, totalBorrowRaw] = await Promise.all([
    client.readContract({ address: deployment.comet, abi: cometAbi, functionName: "getUtilization" }),
    client.readContract({ address: deployment.comet, abi: cometAbi, functionName: "totalSupply" }),
    client.readContract({ address: deployment.comet, abi: cometAbi, functionName: "totalBorrow" }),
  ]);

  const [supplyRate, borrowRate] = await Promise.all([
    client.readContract({ address: deployment.comet, abi: cometAbi, functionName: "getSupplyRate", args: [utilization] }),
    client.readContract({ address: deployment.comet, abi: cometAbi, functionName: "getBorrowRate", args: [utilization] }),
  ]);

  const supplyAPY = ratePerSecondToAPY(supplyRate);
  const borrowAPY = ratePerSecondToAPY(borrowRate);
  const totalSupply = Number(formatUnits(totalSupplyRaw, deployment.borrowDecimals));
  const totalBorrow = Number(formatUnits(totalBorrowRaw, deployment.borrowDecimals));
  const util = Number(utilization) / FACTOR_SCALE * 100;

  const collaterals = collateralFilter && collateralFilter !== "all"
    ? deployment.collaterals.filter(
        (c) => c.symbol.toLowerCase() === collateralFilter.toLowerCase() || c.category === collateralFilter
      )
    : deployment.collaterals;

  const results: ProtocolRate[] = [];
  const chainLabel = deployment.chain === "ethereum" ? "" : ` (${deployment.chain})`;
  const numAssets = await client.readContract({ address: deployment.comet, abi: cometAbi, functionName: "numAssets" });

  for (const coll of collaterals) {
    try {
      let maxLTV = 0;
      let liqThreshold = 0;
      let liqPenalty = 0;

      for (let i = 0; i < numAssets; i++) {
        const info = await client.readContract({
          address: deployment.comet,
          abi: cometAbi,
          functionName: "getAssetInfo",
          args: [i],
        });
        if (info.asset.toLowerCase() === coll.address.toLowerCase()) {
          maxLTV = Number(info.borrowCollateralFactor) / FACTOR_SCALE * 100;
          liqThreshold = Number(info.liquidateCollateralFactor) / FACTOR_SCALE * 100;
          liqPenalty = (1 - Number(info.liquidationFactor) / FACTOR_SCALE) * 100;
          break;
        }
      }

      results.push({
        protocol: "compound-v3",
        chain: deployment.chain,
        market: `Compound V3${chainLabel} ${coll.symbol}/${deployment.borrowAsset}`,
        collateral: coll.symbol,
        borrowAsset: deployment.borrowAsset,
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
      log.warn(`Compound V3 asset info for ${coll.symbol} on ${deployment.chain} failed`, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (results.length > 0) await cacheSet(cacheKey, results, CACHE_TTL.rates);
  return results;
}

export async function getCompoundRates(
  collateralFilter?: string,
  borrowAsset: string = "USDC",
  chains?: SupportedChain[]
): Promise<ProtocolRate[]> {
  const deployments = COMET_DEPLOYMENTS.filter(
    (d) => d.borrowAsset === borrowAsset && (!chains || chains.includes(d.chain))
  );

  const results = await Promise.allSettled(
    deployments.map((d) => getCompoundRatesForDeployment(d, collateralFilter))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export async function getCompoundPosition(
  userAddress: Address,
  collateralFilter?: string,
  chains?: SupportedChain[]
): Promise<PositionData[]> {
  const deployments = COMET_DEPLOYMENTS.filter(
    (d) => !chains || chains.includes(d.chain)
  );

  const allPositions: PositionData[] = [];

  for (const deployment of deployments) {
    const client = getClient(deployment.chain);
    const chainLabel = deployment.chain === "ethereum" ? "" : ` (${deployment.chain})`;

    try {
      const borrowBalance = await client.readContract({
        address: deployment.comet,
        abi: cometAbi,
        functionName: "borrowBalanceOf",
        args: [userAddress],
      });

      const debtAmount = Number(formatUnits(borrowBalance, deployment.borrowDecimals));

      const collaterals = collateralFilter && collateralFilter !== "all"
        ? deployment.collaterals.filter((c) => c.symbol.toLowerCase() === collateralFilter?.toLowerCase())
        : deployment.collaterals;

      for (const coll of collaterals) {
        try {
          const collBalance = await client.readContract({
            address: deployment.comet,
            abi: cometAbi,
            functionName: "collateralBalanceOf",
            args: [userAddress, coll.address],
          });

          const collAmount = Number(formatUnits(collBalance, coll.decimals));
          if (collAmount === 0 && debtAmount === 0) continue;

          const price = await getTokenPrice(coll.symbol);
          const collUSD = collAmount * price;

          const numAssets = await client.readContract({ address: deployment.comet, abi: cometAbi, functionName: "numAssets" });
          let liqThreshold = 0.85;
          for (let i = 0; i < numAssets; i++) {
            const info = await client.readContract({
              address: deployment.comet,
              abi: cometAbi,
              functionName: "getAssetInfo",
              args: [i],
            });
            if (info.asset.toLowerCase() === coll.address.toLowerCase()) {
              liqThreshold = Number(info.liquidateCollateralFactor) / FACTOR_SCALE;
              break;
            }
          }

          const currentLTV = collUSD > 0 ? (debtAmount / collUSD) * 100 : 0;
          const healthFactor = currentLTV > 0 ? (liqThreshold * 100) / currentLTV : Infinity;
          const liquidationPrice = collAmount > 0 ? debtAmount / (collAmount * liqThreshold) : 0;
          const distanceToLiq = price > 0 ? ((price - liquidationPrice) / price) * 100 : 0;

          const utilization = await client.readContract({
            address: deployment.comet,
            abi: cometAbi,
            functionName: "getUtilization",
          });
          const borrowRateRaw = await client.readContract({
            address: deployment.comet,
            abi: cometAbi,
            functionName: "getBorrowRate",
            args: [utilization],
          });
          const borrowRate = ratePerSecondToAPY(borrowRateRaw);

          allPositions.push({
            protocol: "compound-v3",
            market: `Compound V3${chainLabel} ${coll.symbol}`,
            address: userAddress,
            collateral: { asset: coll.symbol, amount: collAmount, valueUSD: collUSD },
            debt: { asset: deployment.borrowAsset, amount: debtAmount, valueUSD: debtAmount },
            currentLTV,
            healthFactor,
            liquidationPrice,
            distanceToLiquidation: distanceToLiq,
            borrowRate,
            estimatedAnnualCost: debtAmount * (borrowRate / 100),
          });
        } catch (e) {
          log.warn(`Compound V3 position for ${coll.symbol} on ${deployment.chain} failed`, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } catch (e) {
      log.warn(`Compound V3 borrow balance on ${deployment.chain} failed`, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return allPositions;
}
