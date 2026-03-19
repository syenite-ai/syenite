import { type Address, formatUnits } from "viem";
import { getClient, type SupportedChain } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { getTokenPrice } from "./prices.js";
import { log } from "../logging/logger.js";
import {
  AAVE_V3,
  AAVE_V3_ARBITRUM,
  AAVE_V3_BASE,
  SPARK,
  TOKENS,
  TOKENS_ARBITRUM,
  TOKENS_BASE,
  TOKEN_DECIMALS,
  TOKEN_DECIMALS_ARBITRUM,
  TOKEN_DECIMALS_BASE,
  COLLATERAL_ASSETS,
  COLLATERAL_ASSETS_ARBITRUM,
  COLLATERAL_ASSETS_BASE,
  CACHE_TTL,
  RAY,
  type Protocol,
  type ProtocolRate,
  type PositionData,
} from "./types.js";

interface ChainDeployment {
  chain: SupportedChain;
  pool: Address;
  poolDataProvider: Address;
  tokens: Record<string, Address>;
  tokenDecimals: Record<string, number>;
  collateralAssets: Array<{ symbol: string; address: Address; category: string }>;
}

const AAVE_DEPLOYMENTS: Record<string, ChainDeployment> = {
  ethereum: {
    chain: "ethereum",
    pool: AAVE_V3.pool,
    poolDataProvider: AAVE_V3.poolDataProvider,
    tokens: TOKENS,
    tokenDecimals: TOKEN_DECIMALS,
    collateralAssets: COLLATERAL_ASSETS,
  },
  arbitrum: {
    chain: "arbitrum",
    pool: AAVE_V3_ARBITRUM.pool,
    poolDataProvider: AAVE_V3_ARBITRUM.poolDataProvider,
    tokens: TOKENS_ARBITRUM,
    tokenDecimals: TOKEN_DECIMALS_ARBITRUM,
    collateralAssets: COLLATERAL_ASSETS_ARBITRUM,
  },
  base: {
    chain: "base",
    pool: AAVE_V3_BASE.pool,
    poolDataProvider: AAVE_V3_BASE.poolDataProvider,
    tokens: TOKENS_BASE,
    tokenDecimals: TOKEN_DECIMALS_BASE,
    collateralAssets: COLLATERAL_ASSETS_BASE,
  },
};

const SPARK_DEPLOYMENTS: Record<string, ChainDeployment> = {
  ethereum: {
    chain: "ethereum",
    pool: SPARK.pool,
    poolDataProvider: SPARK.poolDataProvider,
    tokens: TOKENS,
    tokenDecimals: TOKEN_DECIMALS,
    collateralAssets: COLLATERAL_ASSETS,
  },
};

// ── Minimal ABIs ────────────────────────────────────────────────────

const poolAbi = [
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;

const dataProviderAbi = [
  {
    name: "getReserveConfigurationData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "decimals", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "liquidationThreshold", type: "uint256" },
      { name: "liquidationBonus", type: "uint256" },
      { name: "reserveFactor", type: "uint256" },
      { name: "usageAsCollateralEnabled", type: "bool" },
      { name: "borrowingEnabled", type: "bool" },
      { name: "stableBorrowRateEnabled", type: "bool" },
      { name: "isActive", type: "bool" },
      { name: "isFrozen", type: "bool" },
    ],
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      { name: "unbacked", type: "uint256" },
      { name: "accruedToTreasuryScaled", type: "uint256" },
      { name: "totalAToken", type: "uint256" },
      { name: "totalStableDebt", type: "uint256" },
      { name: "totalVariableDebt", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "variableBorrowRate", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "averageStableBorrowRate", type: "uint256" },
      { name: "liquidityIndex", type: "uint256" },
      { name: "variableBorrowIndex", type: "uint256" },
      { name: "lastUpdateTimestamp", type: "uint40" },
    ],
  },
  {
    name: "getUserReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "asset", type: "address" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "currentATokenBalance", type: "uint256" },
      { name: "currentStableDebt", type: "uint256" },
      { name: "currentVariableDebt", type: "uint256" },
      { name: "principalStableDebt", type: "uint256" },
      { name: "scaledVariableDebt", type: "uint256" },
      { name: "stableBorrowRate", type: "uint256" },
      { name: "liquidityRate", type: "uint256" },
      { name: "stableRateLastUpdated", type: "uint40" },
      { name: "usageAsCollateralEnabled", type: "bool" },
    ],
  },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────

// Aave V3 rates from getReserveData are annualized rates in RAY (1e27)
function rayToPercent(rayRate: bigint): number {
  return (Number(rayRate) / Number(RAY)) * 100;
}

// ── Shared Aave-fork fetcher (used by Aave v3 and Spark) ────────────

async function getAaveForkRatesForDeployment(
  protocolName: Protocol,
  deployment: ChainDeployment,
  collateralFilter?: string,
  borrowAsset: string = "USDC"
): Promise<ProtocolRate[]> {
  const cacheKey = `${protocolName}:${deployment.chain}:rates:${collateralFilter ?? "all"}:${borrowAsset}`;
  const cached = await cacheGet<ProtocolRate[]>(cacheKey);
  if (cached) return cached;

  const client = getClient(deployment.chain);

  const assets =
    collateralFilter && collateralFilter !== "all"
      ? deployment.collateralAssets.filter((a) => a.symbol === collateralFilter || a.category === collateralFilter)
      : deployment.collateralAssets;

  const borrowAssetAddress = deployment.tokens[borrowAsset];
  if (!borrowAssetAddress) return [];

  const borrowReserve = await client.readContract({
    address: deployment.pool,
    abi: poolAbi,
    functionName: "getReserveData",
    args: [borrowAssetAddress],
  });
  const borrowAPY = rayToPercent(borrowReserve.currentVariableBorrowRate);
  const borrowAssetSupplyAPY = rayToPercent(borrowReserve.currentLiquidityRate);

  const borrowDpData = await client.readContract({
    address: deployment.poolDataProvider,
    abi: dataProviderAbi,
    functionName: "getReserveData",
    args: [borrowAssetAddress],
  });
  const borrowDecimals = deployment.tokenDecimals[borrowAsset] ?? 6;
  const totalBorrowSupply = Number(formatUnits(borrowDpData[2], borrowDecimals));
  const totalBorrowed =
    Number(formatUnits(borrowDpData[3], borrowDecimals)) +
    Number(formatUnits(borrowDpData[4], borrowDecimals));
  const borrowAvailableLiquidity = totalBorrowSupply - totalBorrowed;
  const borrowUtilization =
    totalBorrowSupply > 0 ? (totalBorrowed / totalBorrowSupply) * 100 : 0;

  const results: ProtocolRate[] = [];
  const displayName = protocolName === "aave-v3" ? "Aave v3" : "Spark";
  const chainLabel = deployment.chain === "ethereum" ? "" : ` (${deployment.chain})`;

  for (const asset of assets) {
    try {
      const [configData, collateralReserve] = await Promise.all([
        client.readContract({
          address: deployment.poolDataProvider,
          abi: dataProviderAbi,
          functionName: "getReserveConfigurationData",
          args: [asset.address],
        }),
        client.readContract({
          address: deployment.pool,
          abi: poolAbi,
          functionName: "getReserveData",
          args: [asset.address],
        }),
      ]);

      if (!configData[8]) continue;
      if (!configData[5]) continue;

      const supplyAPY = rayToPercent(collateralReserve.currentLiquidityRate);
      const liquidationPenalty = (Number(configData[3]) - 10000) / 100;

      results.push({
        protocol: protocolName,
        chain: deployment.chain,
        market: `${displayName}${chainLabel} ${asset.symbol}/${borrowAsset}`,
        collateral: asset.symbol,
        borrowAsset,
        supplyAPY,
        borrowAssetSupplyAPY,
        borrowAPY,
        availableLiquidity: borrowAvailableLiquidity,
        availableLiquidityUSD: borrowAvailableLiquidity,
        totalSupply: totalBorrowSupply,
        totalBorrow: totalBorrowed,
        utilization: borrowUtilization,
        maxLTV: Number(configData[1]) / 100,
        liquidationThreshold: Number(configData[2]) / 100,
        liquidationPenalty,
        lastUpdated: new Date().toISOString(),
      });
    } catch (e) {
      log.warn(`${protocolName} reserve fetch for ${asset.symbol} on ${deployment.chain} failed`, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (results.length > 0) await cacheSet(cacheKey, results, CACHE_TTL.rates);
  return results;
}

export async function getAaveForkRates(
  protocolName: Protocol,
  poolAddress: Address,
  dataProviderAddress: Address,
  collateralFilter?: string,
  borrowAsset: string = "USDC"
): Promise<ProtocolRate[]> {
  return getAaveForkRatesForDeployment(
    protocolName,
    {
      chain: "ethereum",
      pool: poolAddress,
      poolDataProvider: dataProviderAddress,
      tokens: TOKENS,
      tokenDecimals: TOKEN_DECIMALS,
      collateralAssets: COLLATERAL_ASSETS,
    },
    collateralFilter,
    borrowAsset
  );
}

export async function getAaveRates(
  collateralFilter?: string,
  borrowAsset?: string,
  chains?: SupportedChain[]
): Promise<ProtocolRate[]> {
  const targetChains = chains ?? (Object.keys(AAVE_DEPLOYMENTS) as SupportedChain[]);
  const results = await Promise.allSettled(
    targetChains
      .filter((c) => AAVE_DEPLOYMENTS[c])
      .map((c) => getAaveForkRatesForDeployment("aave-v3", AAVE_DEPLOYMENTS[c], collateralFilter, borrowAsset))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export async function getSparkRates(
  collateralFilter?: string,
  borrowAsset?: string,
  chains?: SupportedChain[]
): Promise<ProtocolRate[]> {
  const targetChains = chains ?? (Object.keys(SPARK_DEPLOYMENTS) as SupportedChain[]);
  const results = await Promise.allSettled(
    targetChains
      .filter((c) => SPARK_DEPLOYMENTS[c])
      .map((c) => getAaveForkRatesForDeployment("spark", SPARK_DEPLOYMENTS[c], collateralFilter, borrowAsset))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function getAaveForkPositionForDeployment(
  protocol: Protocol,
  deployment: ChainDeployment,
  userAddress: Address,
  collateralSymbol?: string
): Promise<PositionData[]> {
  const client = getClient(deployment.chain);
  const positions: PositionData[] = [];

  const accountData = await client.readContract({
    address: deployment.pool,
    abi: poolAbi,
    functionName: "getUserAccountData",
    args: [userAddress],
  });

  const totalCollateralUSD = Number(formatUnits(accountData[0], 8));
  const totalDebtUSD = Number(formatUnits(accountData[1], 8));
  const healthFactor = Number(formatUnits(accountData[5], 18));

  if (totalCollateralUSD === 0 && totalDebtUSD === 0) return [];

  const assets =
    collateralSymbol && collateralSymbol !== "all"
      ? deployment.collateralAssets.filter((a) => a.symbol === collateralSymbol)
      : deployment.collateralAssets;

  const displayName = protocol === "aave-v3" ? "Aave v3" : "Spark";
  const chainLabel = deployment.chain === "ethereum" ? "" : ` (${deployment.chain})`;
  const usdcAddress = deployment.tokens.USDC;

  for (const asset of assets) {
    try {
      const userReserve = await client.readContract({
        address: deployment.poolDataProvider,
        abi: dataProviderAbi,
        functionName: "getUserReserveData",
        args: [asset.address, userAddress],
      });

      const collDecimals = deployment.tokenDecimals[asset.symbol] ?? 18;
      const collateralAmount = Number(formatUnits(userReserve[0], collDecimals));
      if (collateralAmount === 0) continue;

      const assetPrice = await getTokenPrice(asset.symbol);
      const collateralUSD = collateralAmount * assetPrice;
      const currentLTV =
        collateralUSD > 0 ? (totalDebtUSD / collateralUSD) * 100 : 0;

      const liqThreshold = Number(accountData[3]) / 10000;
      const liquidationPrice =
        collateralAmount > 0 && liqThreshold > 0
          ? totalDebtUSD / (collateralAmount * liqThreshold)
          : 0;
      const distanceToLiq =
        assetPrice > 0 ? ((assetPrice - liquidationPrice) / assetPrice) * 100 : 0;

      let borrowRate = 0;
      if (usdcAddress) {
        const usdcReserve = await client.readContract({
          address: deployment.pool,
          abi: poolAbi,
          functionName: "getReserveData",
          args: [usdcAddress],
        });
        borrowRate = rayToPercent(usdcReserve.currentVariableBorrowRate);
      }

      positions.push({
        protocol,
        market: `${displayName}${chainLabel} ${asset.symbol}`,
        address: userAddress,
        collateral: {
          asset: asset.symbol,
          amount: collateralAmount,
          valueUSD: collateralUSD,
        },
        debt: {
          asset: "USDC",
          amount: totalDebtUSD,
          valueUSD: totalDebtUSD,
        },
        currentLTV,
        healthFactor,
        liquidationPrice,
        distanceToLiquidation: distanceToLiq,
        borrowRate,
        estimatedAnnualCost: totalDebtUSD * (borrowRate / 100),
      });
    } catch (e) {
      log.warn(`${displayName} position for ${asset.symbol} on ${deployment.chain} failed`, {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return positions;
}

export async function getAavePosition(
  userAddress: Address,
  collateralSymbol?: string,
  chains?: SupportedChain[]
): Promise<PositionData[]> {
  const targetChains = chains ?? (Object.keys(AAVE_DEPLOYMENTS) as SupportedChain[]);
  const results = await Promise.allSettled(
    targetChains
      .filter((c) => AAVE_DEPLOYMENTS[c])
      .map((c) => getAaveForkPositionForDeployment("aave-v3", AAVE_DEPLOYMENTS[c], userAddress, collateralSymbol))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export async function getSparkPosition(
  userAddress: Address,
  collateralSymbol?: string,
  chains?: SupportedChain[]
): Promise<PositionData[]> {
  const targetChains = chains ?? (Object.keys(SPARK_DEPLOYMENTS) as SupportedChain[]);
  const results = await Promise.allSettled(
    targetChains
      .filter((c) => SPARK_DEPLOYMENTS[c])
      .map((c) => getAaveForkPositionForDeployment("spark", SPARK_DEPLOYMENTS[c], userAddress, collateralSymbol))
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
