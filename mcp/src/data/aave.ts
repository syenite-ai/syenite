import { type Address, formatUnits } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { getTokenPrice } from "./prices.js";
import {
  AAVE_V3,
  SPARK,
  TOKENS,
  TOKEN_DECIMALS,
  COLLATERAL_ASSETS,
  CACHE_TTL,
  RAY,
  type Protocol,
  type ProtocolRate,
  type PositionData,
} from "./types.js";

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

export async function getAaveForkRates(
  protocolName: Protocol,
  poolAddress: Address,
  dataProviderAddress: Address,
  collateralFilter?: string,
  borrowAsset: string = "USDC"
): Promise<ProtocolRate[]> {
  const cacheKey = `${protocolName}:rates:${collateralFilter ?? "all"}:${borrowAsset}`;
  const cached = cacheGet<ProtocolRate[]>(cacheKey);
  if (cached) return cached;

  const client = getClient();

  const assets =
    collateralFilter && collateralFilter !== "all"
      ? COLLATERAL_ASSETS.filter((a) => a.symbol === collateralFilter || a.category === collateralFilter)
      : COLLATERAL_ASSETS;

  const borrowAssetAddress = TOKENS[borrowAsset];
  if (!borrowAssetAddress) return [];

  const borrowReserve = await client.readContract({
    address: poolAddress,
    abi: poolAbi,
    functionName: "getReserveData",
    args: [borrowAssetAddress],
  });
  const borrowAPY = rayToPercent(borrowReserve.currentVariableBorrowRate);

  const borrowDpData = await client.readContract({
    address: dataProviderAddress,
    abi: dataProviderAbi,
    functionName: "getReserveData",
    args: [borrowAssetAddress],
  });
  const borrowDecimals = TOKEN_DECIMALS[borrowAsset] ?? 6;
  const totalBorrowSupply = Number(formatUnits(borrowDpData[2], borrowDecimals));
  const totalBorrowed =
    Number(formatUnits(borrowDpData[3], borrowDecimals)) +
    Number(formatUnits(borrowDpData[4], borrowDecimals));
  const borrowAvailableLiquidity = totalBorrowSupply - totalBorrowed;
  const borrowUtilization =
    totalBorrowSupply > 0 ? (totalBorrowed / totalBorrowSupply) * 100 : 0;

  const results: ProtocolRate[] = [];

  for (const asset of assets) {
    try {
      const [configData, collateralReserve] = await Promise.all([
        client.readContract({
          address: dataProviderAddress,
          abi: dataProviderAbi,
          functionName: "getReserveConfigurationData",
          args: [asset.address],
        }),
        client.readContract({
          address: poolAddress,
          abi: poolAbi,
          functionName: "getReserveData",
          args: [asset.address],
        }),
      ]);

      if (!configData[8]) continue; // isActive
      if (!configData[5]) continue; // usageAsCollateralEnabled

      const supplyAPY = rayToPercent(collateralReserve.currentLiquidityRate);
      const liquidationPenalty = (Number(configData[3]) - 10000) / 100;

      const displayName = protocolName === "aave-v3" ? "Aave v3" : "Spark";
      results.push({
        protocol: protocolName,
        market: `${displayName} ${asset.symbol}/${borrowAsset}`,
        collateral: asset.symbol,
        borrowAsset,
        supplyAPY,
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
    } catch {
      // Reserve not available on Aave v3 for this asset
    }
  }

  if (results.length > 0) cacheSet(cacheKey, results, CACHE_TTL.rates);
  return results;
}

export function getAaveRates(collateralFilter?: string, borrowAsset?: string) {
  return getAaveForkRates("aave-v3", AAVE_V3.pool, AAVE_V3.poolDataProvider, collateralFilter, borrowAsset);
}

export function getSparkRates(collateralFilter?: string, borrowAsset?: string) {
  return getAaveForkRates("spark", SPARK.pool, SPARK.poolDataProvider, collateralFilter, borrowAsset);
}

export async function getAavePosition(
  userAddress: Address,
  collateralSymbol?: string
): Promise<PositionData[]> {
  const client = getClient();
  const positions: PositionData[] = [];

  const accountData = await client.readContract({
    address: AAVE_V3.pool,
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
      ? COLLATERAL_ASSETS.filter((a) => a.symbol === collateralSymbol)
      : COLLATERAL_ASSETS;

  for (const asset of assets) {
    try {
      const userReserve = await client.readContract({
        address: AAVE_V3.poolDataProvider,
        abi: dataProviderAbi,
        functionName: "getUserReserveData",
        args: [asset.address, userAddress],
      });

      const collDecimals = TOKEN_DECIMALS[asset.symbol] ?? 18;
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

      const usdcReserve = await client.readContract({
        address: AAVE_V3.pool,
        abi: poolAbi,
        functionName: "getReserveData",
        args: [TOKENS.USDC],
      });
      const borrowRate = rayToPercent(usdcReserve.currentVariableBorrowRate);

      positions.push({
        protocol: "aave-v3",
        market: `Aave v3 ${asset.symbol}`,
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
    } catch {
      // No position for this asset
    }
  }

  return positions;
}
