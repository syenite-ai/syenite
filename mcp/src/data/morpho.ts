import { type Address, formatUnits } from "viem";
import { getClient } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { getTokenPrice } from "./prices.js";
import {
  MORPHO,
  MORPHO_MARKETS,
  TOKENS,
  TOKEN_DECIMALS,
  CACHE_TTL,
  SECONDS_PER_YEAR,
  WAD,
  type MorphoMarketConfig,
  type ProtocolRate,
  type PositionData,
} from "./types.js";

// ── ABIs ────────────────────────────────────────────────────────────

const morphoAbi = [
  {
    name: "market",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "totalSupplyAssets", type: "uint128" },
      { name: "totalSupplyShares", type: "uint128" },
      { name: "totalBorrowAssets", type: "uint128" },
      { name: "totalBorrowShares", type: "uint128" },
      { name: "lastUpdate", type: "uint128" },
      { name: "fee", type: "uint128" },
    ],
  },
  {
    name: "position",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "supplyShares", type: "uint256" },
      { name: "borrowShares", type: "uint128" },
      { name: "collateral", type: "uint128" },
    ],
  },
] as const;

const irmAbi = [
  {
    name: "borrowRateView",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      {
        name: "market",
        type: "tuple",
        components: [
          { name: "totalSupplyAssets", type: "uint128" },
          { name: "totalSupplyShares", type: "uint128" },
          { name: "totalBorrowAssets", type: "uint128" },
          { name: "totalBorrowShares", type: "uint128" },
          { name: "lastUpdate", type: "uint128" },
          { name: "fee", type: "uint128" },
        ],
      },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const oracleAbi = [
  {
    name: "price",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────

function ratePerSecondToAPY(ratePerSecond: bigint): number {
  const rate = Number(ratePerSecond) / Number(WAD);
  return (Math.pow(1 + rate, SECONDS_PER_YEAR) - 1) * 100;
}

/** Morpho Blue liquidation incentive: min(15%, 1/(1 - cursor*(1-lltv)) - 1) where cursor=0.3 */
function morphoLiquidationPenalty(lltv: number): number {
  const cursor = 0.3;
  const maxPenalty = 15;
  const penalty = (1 / (1 - cursor * (1 - lltv)) - 1) * 100;
  return Math.min(penalty, maxPenalty);
}

function getCollateralSymbol(address: Address): string {
  for (const [symbol, addr] of Object.entries(TOKENS)) {
    if (addr.toLowerCase() === address.toLowerCase()) return symbol;
  }
  return "unknown";
}

// ── Public API ──────────────────────────────────────────────────────

export async function getMorphoRates(
  collateralFilter?: string,
  borrowAsset: string = "USDC"
): Promise<ProtocolRate[]> {
  const cacheKey = `morpho:rates:${collateralFilter ?? "all"}:${borrowAsset}`;
  const cached = cacheGet<ProtocolRate[]>(cacheKey);
  if (cached) return cached;

  const client = getClient();

  let markets = MORPHO_MARKETS;
  if (collateralFilter && collateralFilter !== "all") {
    const filter = collateralFilter.toLowerCase();
    markets = markets.filter((m) => {
      const sym = getCollateralSymbol(m.collateralToken);
      if (sym.toLowerCase() === filter) return true;
      if (filter === "btc" && ["wBTC", "tBTC", "cbBTC"].includes(sym)) return true;
      if (filter === "eth" && ["WETH", "wstETH", "rETH", "cbETH", "weETH"].includes(sym)) return true;
      return false;
    });
  }

  const results: ProtocolRate[] = [];

  for (const mkt of markets) {
    try {
      const marketData = await client.readContract({
        address: MORPHO.blue,
        abi: morphoAbi,
        functionName: "market",
        args: [mkt.id],
      });

      const [
        totalSupplyAssets,
        totalSupplyShares,
        totalBorrowAssets,
        totalBorrowShares,
        lastUpdate,
        fee,
      ] = marketData;

      if (totalSupplyAssets === 0n) continue;

      const borrowRatePerSecond = await client.readContract({
        address: mkt.irm,
        abi: irmAbi,
        functionName: "borrowRateView",
        args: [
          {
            loanToken: mkt.loanToken,
            collateralToken: mkt.collateralToken,
            oracle: mkt.oracle,
            irm: mkt.irm,
            lltv: mkt.lltv,
          },
          {
            totalSupplyAssets,
            totalSupplyShares,
            totalBorrowAssets,
            totalBorrowShares,
            lastUpdate,
            fee,
          },
        ],
      });

      const loanDecimals = 6; // USDC
      const collSymbol = getCollateralSymbol(mkt.collateralToken);
      const collDecimals = TOKEN_DECIMALS[collSymbol] ?? 8;

      const totalSupply = Number(formatUnits(totalSupplyAssets, loanDecimals));
      const totalBorrow = Number(formatUnits(totalBorrowAssets, loanDecimals));
      const utilization = totalSupply > 0 ? totalBorrow / totalSupply : 0;

      const borrowAPY = ratePerSecondToAPY(borrowRatePerSecond);
      const feeRate = Number(fee) / 1e18;
      const supplyAPY = borrowAPY * utilization * (1 - feeRate);

      const availableLiquidityUSD = totalSupply - totalBorrow;

      const lltv = Number(mkt.lltv) / 1e18;

      results.push({
        protocol: "morpho-blue",
        market: `Morpho ${mkt.label}`,
        collateral: collSymbol,
        borrowAsset,
        supplyAPY,
        borrowAPY,
        availableLiquidity: availableLiquidityUSD,
        availableLiquidityUSD,
        totalSupply,
        totalBorrow,
        utilization: utilization * 100,
        maxLTV: lltv * 100,
        liquidationThreshold: lltv * 100,
        liquidationPenalty: morphoLiquidationPenalty(lltv),
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      // Market may not be active — skip
    }
  }

  if (results.length > 0) cacheSet(cacheKey, results, CACHE_TTL.rates);
  return results;
}

export async function getMorphoPosition(
  userAddress: Address,
  collateralFilter?: string
): Promise<PositionData[]> {
  const client = getClient();
  const positions: PositionData[] = [];

  let markets = MORPHO_MARKETS;
  if (collateralFilter && collateralFilter !== "all") {
    const filter = collateralFilter.toLowerCase();
    markets = markets.filter((m) => {
      const sym = getCollateralSymbol(m.collateralToken);
      return sym.toLowerCase() === filter;
    });
  }

  for (const mkt of markets) {
    try {
      const [posData, marketData] = await Promise.all([
        client.readContract({
          address: MORPHO.blue,
          abi: morphoAbi,
          functionName: "position",
          args: [mkt.id, userAddress],
        }),
        client.readContract({
          address: MORPHO.blue,
          abi: morphoAbi,
          functionName: "market",
          args: [mkt.id],
        }),
      ]);

      const [supplyShares, borrowShares, collateral] = posData;
      if (collateral === 0n && borrowShares === 0n) continue;

      const collSymbol = getCollateralSymbol(mkt.collateralToken);
      const collDecimals = TOKEN_DECIMALS[collSymbol] ?? 8;

      const collateralAmount = Number(formatUnits(collateral, collDecimals));
      const assetPrice = await getTokenPrice(collSymbol);
      const collateralUSD = collateralAmount * assetPrice;

      const [totalBorrowAssets, , , totalBorrowShares] = [
        marketData[2],
        marketData[0],
        marketData[1],
        marketData[3],
      ];

      const debtAmount =
        totalBorrowShares > 0n
          ? Number(
              formatUnits(
                (borrowShares * totalBorrowAssets) / totalBorrowShares,
                6
              )
            )
          : 0;

      const lltv = Number(mkt.lltv) / 1e18;
      const currentLTV = collateralUSD > 0 ? (debtAmount / collateralUSD) * 100 : 0;
      const healthFactor = currentLTV > 0 ? (lltv * 100) / currentLTV : Infinity;
      const liquidationPrice =
        collateralAmount > 0 ? debtAmount / (collateralAmount * lltv) : 0;
      const distanceToLiq =
        assetPrice > 0 ? ((assetPrice - liquidationPrice) / assetPrice) * 100 : 0;

      const borrowRatePerSecond = await client.readContract({
        address: mkt.irm,
        abi: irmAbi,
        functionName: "borrowRateView",
        args: [
          {
            loanToken: mkt.loanToken,
            collateralToken: mkt.collateralToken,
            oracle: mkt.oracle,
            irm: mkt.irm,
            lltv: mkt.lltv,
          },
          {
            totalSupplyAssets: marketData[0],
            totalSupplyShares: marketData[1],
            totalBorrowAssets: marketData[2],
            totalBorrowShares: marketData[3],
            lastUpdate: marketData[4],
            fee: marketData[5],
          },
        ],
      });

      const borrowRate = ratePerSecondToAPY(borrowRatePerSecond);

      positions.push({
        protocol: "morpho-blue",
        market: `Morpho ${mkt.label}`,
        address: userAddress,
        collateral: {
          asset: collSymbol,
          amount: collateralAmount,
          valueUSD: collateralUSD,
        },
        debt: { asset: "USDC", amount: debtAmount, valueUSD: debtAmount },
        currentLTV,
        healthFactor,
        liquidationPrice,
        distanceToLiquidation: distanceToLiq,
        borrowRate,
        estimatedAnnualCost: debtAmount * (borrowRate / 100),
      });
    } catch {
      // Skip markets where user has no position
    }
  }

  return positions;
}
