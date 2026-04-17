import { type Address, formatUnits, getAddress } from "viem";
import { getClient, type SupportedChain } from "./client.js";
import { cacheGet, cacheSet } from "./cache.js";
import { getTokenPrice } from "./prices.js";
import { log } from "../logging/logger.js";
import {
  MORPHO,
  MORPHO_MARKETS,
  MORPHO_BLUE_BY_CHAIN,
  CHAIN_IDS,
  TOKENS,
  TOKEN_DECIMALS,
  CACHE_TTL,
  SECONDS_PER_YEAR,
  WAD,
  type MorphoMarketConfig,
  type ProtocolRate,
  type PositionData,
  type VaultData,
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
  const cached = await cacheGet<ProtocolRate[]>(cacheKey);
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
        chain: "ethereum",
        market: `Morpho ${mkt.label}`,
        collateral: collSymbol,
        borrowAsset,
        supplyAPY,
        borrowAssetSupplyAPY: supplyAPY,
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
    } catch (e) {
      log.warn(`Morpho market ${mkt.label} failed`, { error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (results.length > 0) await cacheSet(cacheKey, results, CACHE_TTL.rates);
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
    } catch (e) {
      log.warn(`Morpho position for ${mkt.label} failed`, { error: e instanceof Error ? e.message : String(e) });
    }
  }

  return positions;
}

// ── GraphQL-backed multi-chain data ─────────────────────────────────

const MORPHO_API = "https://blue-api.morpho.org/graphql";

async function fetchMorphoGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(MORPHO_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      log.warn("morpho graphql non-ok", { status: res.status, url: MORPHO_API });
      return null;
    }
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) {
      log.warn("morpho graphql errors", { errors: JSON.stringify(json.errors).slice(0, 500) });
      return null;
    }
    return json.data ?? null;
  } catch (e) {
    log.warn("morpho graphql fetch failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

interface GraphQLMarket {
  uniqueKey: string;
  loanAsset: { symbol: string; decimals: number } | null;
  collateralAsset: { symbol: string } | null;
  state: {
    supplyApy: number;
    borrowApy: number;
    supplyAssetsUsd: number;
    borrowAssetsUsd: number;
    liquidityAssetsUsd: number;
    utilization: number;
    fee: number;
  } | null;
  lltv: string;
}

interface GraphQLMarketsResponse {
  markets: { items: GraphQLMarket[] };
}

export async function getMorphoRatesViaGraphQL(
  chain: string,
  collateralFilter?: string,
  borrowAsset: string = "USDC"
): Promise<ProtocolRate[]> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return [];
  const cacheKey = `morpho-gql:rates:${chain}:${collateralFilter ?? "all"}:${borrowAsset}`;
  const cached = await cacheGet<ProtocolRate[]>(cacheKey);
  if (cached) return cached;

  const query = `
    query Markets($chainId: Int!, $borrow: String!) {
      markets(
        first: 50
        where: { chainId_in: [$chainId], loanAssetSymbol_in: [$borrow], whitelisted: true }
        orderBy: SupplyAssetsUsd
        orderDirection: Desc
      ) {
        items {
          uniqueKey
          loanAsset { symbol decimals }
          collateralAsset { symbol }
          state {
            supplyApy
            borrowApy
            supplyAssetsUsd
            borrowAssetsUsd
            liquidityAssetsUsd
            utilization
            fee
          }
          lltv
        }
      }
    }
  `;
  const data = await fetchMorphoGraphQL<GraphQLMarketsResponse>(query, { chainId, borrow: borrowAsset });
  if (!data) return [];

  const filter = collateralFilter?.toLowerCase();
  const items = data.markets.items;
  const results: ProtocolRate[] = [];

  for (const m of items) {
    if (!m.state || !m.collateralAsset || !m.loanAsset) continue;
    const collSymbol = m.collateralAsset.symbol;
    if (filter && filter !== "all") {
      const cs = collSymbol.toLowerCase();
      const isMatch =
        cs === filter ||
        (filter === "btc" && /btc/.test(cs)) ||
        (filter === "eth" && /eth/.test(cs));
      if (!isMatch) continue;
    }
    const lltv = Number(m.lltv) / 1e18;
    const supplyAPY = (m.state.supplyApy ?? 0) * 100;
    const borrowAPY = (m.state.borrowApy ?? 0) * 100;

    results.push({
      protocol: "morpho-blue",
      chain,
      market: `Morpho ${collSymbol}/${m.loanAsset.symbol} (${chain})`,
      collateral: collSymbol,
      borrowAsset: m.loanAsset.symbol,
      supplyAPY,
      borrowAssetSupplyAPY: supplyAPY,
      borrowAPY,
      availableLiquidity: m.state.liquidityAssetsUsd ?? 0,
      availableLiquidityUSD: m.state.liquidityAssetsUsd ?? 0,
      totalSupply: m.state.supplyAssetsUsd ?? 0,
      totalBorrow: m.state.borrowAssetsUsd ?? 0,
      utilization: (m.state.utilization ?? 0) * 100,
      maxLTV: lltv * 100,
      liquidationThreshold: lltv * 100,
      liquidationPenalty: morphoLiquidationPenalty(lltv),
      lastUpdated: new Date().toISOString(),
    });
  }

  if (results.length > 0) await cacheSet(cacheKey, results, CACHE_TTL.rates);
  return results;
}

/** Multi-chain Morpho Blue rates — routes to on-chain for Ethereum, GraphQL for other chains. */
export async function getMorphoRatesMultiChain(
  collateralFilter?: string,
  borrowAsset: string = "USDC",
  chains?: SupportedChain[]
): Promise<ProtocolRate[]> {
  const targetChains =
    chains && chains.length > 0 ? chains : (Object.keys(MORPHO_BLUE_BY_CHAIN) as SupportedChain[]);
  const results = await Promise.allSettled(
    targetChains.map((chain) =>
      chain === "ethereum"
        ? getMorphoRates(collateralFilter, borrowAsset)
        : getMorphoRatesViaGraphQL(chain, collateralFilter, borrowAsset)
    )
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// ── MetaMorpho vault discovery ──────────────────────────────────────

interface GraphQLVault {
  address: string;
  name: string;
  asset: { symbol: string } | null;
  metadata: { curators: Array<{ name: string }> | null } | null;
  state: {
    netApy: number;
    totalAssetsUsd: number;
    fee: number;
    allocation: Array<{
      market: {
        uniqueKey: string;
        collateralAsset: { symbol: string } | null;
      } | null;
      supplyAssetsUsd: number;
    }> | null;
  } | null;
}

interface GraphQLVaultsResponse {
  vaults: { items: GraphQLVault[] };
}

function mapVault(v: GraphQLVault, chain: string): VaultData | null {
  if (!v.state || !v.asset) return null;
  const curatorNames = v.metadata?.curators?.map((c) => c.name).filter(Boolean) ?? [];
  const curator = curatorNames.length > 0 ? curatorNames.join(", ") : "Unknown";
  const allocations = v.state.allocation ?? [];
  const totalAllocated = allocations.reduce((sum, a) => sum + (a.supplyAssetsUsd ?? 0), 0);
  const topMarkets = allocations
    .filter((a) => a.market && (a.supplyAssetsUsd ?? 0) > 0)
    .sort((a, b) => (b.supplyAssetsUsd ?? 0) - (a.supplyAssetsUsd ?? 0))
    .slice(0, 5)
    .map((a) => ({
      id: a.market!.uniqueKey,
      allocation: totalAllocated > 0 ? (a.supplyAssetsUsd ?? 0) / totalAllocated : 0,
      collateral: a.market!.collateralAsset?.symbol ?? "unknown",
    }));
  let addr: Address;
  try {
    addr = getAddress(v.address);
  } catch {
    return null;
  }
  return {
    address: addr,
    name: v.name,
    curator,
    asset: v.asset.symbol,
    chain,
    netAPY: (v.state.netApy ?? 0) * 100,
    tvlUSD: v.state.totalAssetsUsd ?? 0,
    feeBps: Math.round((v.state.fee ?? 0) * 10_000),
    marketCount: allocations.filter((a) => a.market).length,
    topMarkets,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getMetaMorphoVaults(chain: string = "ethereum"): Promise<VaultData[]> {
  const chainId = CHAIN_IDS[chain];
  if (!chainId) return [];
  const cacheKey = `metamorpho:vaults:${chain}`;
  const cached = await cacheGet<VaultData[]>(cacheKey);
  if (cached) return cached;

  const query = `
    query Vaults($chainId: Int!) {
      vaults(
        first: 25
        where: { chainId_in: [$chainId], whitelisted: true }
        orderBy: TotalAssetsUsd
        orderDirection: Desc
      ) {
        items {
          address
          name
          asset { symbol }
          metadata { curators { name } }
          state {
            netApy
            totalAssetsUsd
            fee
            allocation {
              market { uniqueKey collateralAsset { symbol } }
              supplyAssetsUsd
            }
          }
        }
      }
    }
  `;
  const data = await fetchMorphoGraphQL<GraphQLVaultsResponse>(query, { chainId });
  if (!data) return [];
  const vaults = data.vaults.items
    .map((v) => mapVault(v, chain))
    .filter((v): v is VaultData => v !== null);
  if (vaults.length > 0) await cacheSet(cacheKey, vaults, CACHE_TTL.yield);
  return vaults;
}

export async function getAllMetaMorphoVaults(chains?: string[]): Promise<VaultData[]> {
  const targetChains = chains ?? Object.keys(MORPHO_BLUE_BY_CHAIN);
  const results = await Promise.allSettled(targetChains.map((c) => getMetaMorphoVaults(c)));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
