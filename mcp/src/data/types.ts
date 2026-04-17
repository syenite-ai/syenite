import { getAddress, type Address } from "viem";

// ── Protocol types ──────────────────────────────────────────────────

export type Protocol =
  | "aave-v3"
  | "morpho-blue"
  | "spark"
  | "compound-v3"
  | "fluid"
  | "venus"
  | "euler-v2"
  | "liquity-v2"
  | "kamino"
  | "marginfi"
  | "drift";

// ── Contract addresses (Ethereum mainnet) ───────────────────────────
// All addresses normalized via getAddress() to ensure correct EIP-55 checksums

export const TOKENS: Record<string, Address> = {
  // BTC ecosystem
  wBTC: getAddress("0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"),
  tBTC: getAddress("0x18084fba666a33d37592fa2633fd49a74dd93a88"),
  cbBTC: getAddress("0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf"),
  // ETH ecosystem
  WETH: getAddress("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"),
  wstETH: getAddress("0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0"),
  rETH: getAddress("0xae78736cd615f374d3085123a210448e74fc6393"),
  cbETH: getAddress("0xbe9895146f7af43049ca1c1ae358b0541ea49704"),
  weETH: getAddress("0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee"),
  // Stablecoins
  USDC: getAddress("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"),
  USDT: getAddress("0xdac17f958d2ee523a2206206994597c13d831ec7"),
  DAI: getAddress("0x6b175474e89094c44da98b954eedeac495271d0f"),
  GHO: getAddress("0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f"),
  sDAI: getAddress("0x83f20f44975d03b1b09e64809b757c47f942beea"),
};

/** Maps a token symbol to its Chainlink price feed pair */
export const TOKEN_PRICE_FEED: Record<string, string> = {
  wBTC: "BTC/USD",
  tBTC: "BTC/USD",
  cbBTC: "BTC/USD",
  WETH: "ETH/USD",
  wstETH: "ETH/USD",
  rETH: "ETH/USD",
  cbETH: "ETH/USD",
  weETH: "ETH/USD",
  USDC: "USDC/USD",
  USDT: "USDT/USD",
  DAI: "DAI/USD",
  GHO: "USDC/USD",
  sDAI: "DAI/USD",
};

export const AAVE_V3 = {
  pool: getAddress("0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"),
  poolDataProvider: getAddress("0x0a16f2fcc0d44fae41cc54e079281d84a363becd"),
  uiPoolDataProvider: getAddress("0x91c0ea31b49b69ea18607702c5d9ac360bf3de7d"),
};

export const AAVE_V3_ARBITRUM = {
  pool: getAddress("0x794a61358D6845594F94dc1DB02A252b5b4814aD"),
  poolDataProvider: getAddress("0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654"),
};

export const AAVE_V3_BASE = {
  pool: getAddress("0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"),
  poolDataProvider: getAddress("0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac"),
};

export const SPARK = {
  pool: getAddress("0xc13e21b648a5ee794902342038ff3adab66be987"),
  poolDataProvider: getAddress("0xfc21d6d146e6086b8359705c8b28512a983db0cb"),
};

export const MORPHO = {
  blue: getAddress("0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb"),
  adaptiveCurveIrm: getAddress("0x870ac11d48b15db9a138cf899d20f13f79ba00bc"),
};

export const CHAINLINK_FEEDS: Record<string, Address> = {
  "BTC/USD": getAddress("0xf4030086522a5beea4988f8ca5b36dbc97bee88c"),
  "ETH/USD": getAddress("0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"),
  "USDC/USD": getAddress("0x8fffffd4afb6115b954bd326cbe7b4ba576818f6"),
  "USDT/USD": getAddress("0x3e7d1eab13ad0104d2750b8863b489d65364e32d"),
  "DAI/USD": getAddress("0xaed0c38402a5d19df6e4c03f4e2dced6e29c1ee9"),
};

export const TOKEN_DECIMALS: Record<string, number> = {
  wBTC: 8,
  tBTC: 18,
  cbBTC: 8,
  WETH: 18,
  wstETH: 18,
  rETH: 18,
  cbETH: 18,
  weETH: 18,
  USDC: 6,
  USDT: 6,
  DAI: 18,
  GHO: 18,
  sDAI: 18,
};

/** All collateral assets grouped by category */
export const COLLATERAL_ASSETS: Array<{ symbol: string; address: Address; category: string }> = [
  { symbol: "wBTC", address: TOKENS.wBTC, category: "BTC" },
  { symbol: "tBTC", address: TOKENS.tBTC, category: "BTC" },
  { symbol: "cbBTC", address: TOKENS.cbBTC, category: "BTC" },
  { symbol: "WETH", address: TOKENS.WETH, category: "ETH" },
  { symbol: "wstETH", address: TOKENS.wstETH, category: "ETH" },
  { symbol: "rETH", address: TOKENS.rETH, category: "ETH" },
  { symbol: "cbETH", address: TOKENS.cbETH, category: "ETH" },
  { symbol: "weETH", address: TOKENS.weETH, category: "ETH" },
];

// ── Known Morpho Blue market params (Ethereum mainnet) ──────────────
// Markets are identified by hash of (loanToken, collateralToken, oracle, irm, lltv)

export interface MorphoMarketConfig {
  id: `0x${string}`;
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
  label: string;
}

export const MORPHO_MARKETS: MorphoMarketConfig[] = [
  // BTC collateral markets
  {
    id: "0xb8fc70e82bc5bb53e773626228571b2440c3b3e7c1be5fee3c0a7e2598327cc0",
    loanToken: TOKENS.USDC,
    collateralToken: TOKENS.wBTC,
    oracle: getAddress("0xdddd770badd886df3864029e4b377b5f6a2b6b83"),
    irm: MORPHO.adaptiveCurveIrm,
    lltv: 860000000000000000n,
    label: "wBTC/USDC (86% LLTV)",
  },
  {
    id: "0xa921ef34e2fc7a27ccc50ae7e4b154e16c9799d3387076c421423ef52ac4df99",
    loanToken: TOKENS.USDC,
    collateralToken: TOKENS.tBTC,
    oracle: getAddress("0x008bf4b1cda0cc9f0e882e0697f036667652e1ef"),
    irm: MORPHO.adaptiveCurveIrm,
    lltv: 860000000000000000n,
    label: "tBTC/USDC (86% LLTV)",
  },
  {
    id: "0xb1a0b5fcfb07e56ab7a4ab97e48e28268199170a4f0b1c8c1c7e0a1cc70deae3",
    loanToken: TOKENS.USDC,
    collateralToken: TOKENS.cbBTC,
    oracle: getAddress("0x663becd10dae6c4a3dcd89f1d76c0edce60e12de"),
    irm: MORPHO.adaptiveCurveIrm,
    lltv: 860000000000000000n,
    label: "cbBTC/USDC (86% LLTV)",
  },
  // ETH collateral markets
  {
    id: "0x6d2fba32b8649d92432d036c16aa80779034b7469b63abc259b17678857f31c2",
    loanToken: TOKENS.USDC,
    collateralToken: TOKENS.wstETH,
    oracle: getAddress("0x48f7e36eb6b826b2df4b2e630b62cd25e89e40e2"),
    irm: MORPHO.adaptiveCurveIrm,
    lltv: 860000000000000000n,
    label: "wstETH/USDC (86% LLTV)",
  },
  // WETH/USDC removed — market ID and oracle were incorrect.
  // Canonical market: 0x94b823e6bd8ea533b4e33fbc307faea0b307301bc48763acc4d4aa4def7636cd
  // Re-add after verifying oracle address via idToMarketParams on-chain.
];

// ── Yield source contracts (Ethereum mainnet) ───────────────────────

export const MAKER = {
  pot: getAddress("0x197e90f9fad81970ba7976f33cbd77088e5d7cf7"),
  sDAI: TOKENS.sDAI,
};

export const LIDO = {
  stETH: getAddress("0xae7ab96520de3a18e5e111b5eaab095312d7fe84"),
  wstETH: TOKENS.wstETH,
  accountingOracle: getAddress("0x852ded011285fe67063a08005c71a85690503cee"),
};

export const ROCKET_POOL = {
  rETH: TOKENS.rETH,
  storage: getAddress("0x1d8f8f00cfa6758d7be78336684788fb0ee0fa46"),
};

export const COINBASE = {
  cbETH: TOKENS.cbETH,
};

export const ETHENA = {
  USDe: getAddress("0x4c9edd5852cd905f086c759e8383e09bff1e68b3"),
  sUSDe: getAddress("0x9d39a5de30e57443bff2a8307a4256c8797a3497"),
};

export const YEARN = {
  aprOracle: getAddress("0x27ab1d3bfa3801551e9e4dbc34e5e1d6096fc00d"),
};

/** Blue-chip Morpho MetaMorpho vault addresses */
export const METAMORPHO_VAULTS: Array<{ address: Address; label: string; asset: string }> = [
  { address: getAddress("0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB"), label: "Steakhouse USDC", asset: "USDC" },
  { address: getAddress("0x78Fc2c2eD71dAb0491d268e004e5c6aDFaf11300"), label: "Gauntlet USDC Prime", asset: "USDC" },
  { address: getAddress("0x2371e134e3455e0593363cBF89d3b6cf53740618"), label: "Steakhouse USDT", asset: "USDT" },
  { address: getAddress("0xA0E430870c4604CcfC7B38Ca7845B1FF653D0ff1"), label: "Gauntlet WETH Prime", asset: "WETH" },
];

/** Blue-chip Yearn v3 vault addresses */
export const YEARN_VAULTS: Array<{ address: Address; label: string; asset: string }> = [
  { address: getAddress("0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204"), label: "Yearn USDC", asset: "USDC" },
  { address: getAddress("0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE"), label: "Yearn USDT", asset: "USDT" },
  { address: getAddress("0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0"), label: "Yearn WETH", asset: "WETH" },
];

// Pendle PT markets deprecated — expired maturities, pending update.

// ── Multi-chain Morpho Blue contract addresses ──────────────────────
// Source: https://docs.morpho.org/addresses/

export const MORPHO_BLUE_BY_CHAIN: Record<string, Address> = {
  ethereum: getAddress("0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb"),
  base: getAddress("0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"),
  arbitrum: getAddress("0x6c247b1F6182318877311737BaC0844bAa518F5e"),
  optimism: getAddress("0xce95AfbB8EA029495c66020883F87aaE8864AF92"),
};

// ── Pendle — REST API endpoints ─────────────────────────────────────

export const PENDLE_API_BASE = "https://api-v2.pendle.finance/core/v1";

/** Pendle supports these chain IDs for PT/YT markets. */
export const PENDLE_CHAINS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  bsc: 56,
  optimism: 10,
};

// ── Multi-chain token addresses ──────────────────────────────────────

export const TOKENS_ARBITRUM: Record<string, Address> = {
  WBTC: getAddress("0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f"),
  WETH: getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1"),
  wstETH: getAddress("0x5979D7b546E38E414F7E9822514be443A4800529"),
  rETH: getAddress("0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8"),
  USDC: getAddress("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
  "USDC.e": getAddress("0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"),
  USDT: getAddress("0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"),
  DAI: getAddress("0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"),
};

export const TOKENS_BASE: Record<string, Address> = {
  WETH: getAddress("0x4200000000000000000000000000000000000006"),
  cbETH: getAddress("0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22"),
  wstETH: getAddress("0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452"),
  USDbC: getAddress("0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA"),
  USDC: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  cbBTC: getAddress("0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"),
};

export const COLLATERAL_ASSETS_ARBITRUM: Array<{ symbol: string; address: Address; category: string }> = [
  { symbol: "WBTC", address: TOKENS_ARBITRUM.WBTC, category: "BTC" },
  { symbol: "WETH", address: TOKENS_ARBITRUM.WETH, category: "ETH" },
  { symbol: "wstETH", address: TOKENS_ARBITRUM.wstETH, category: "ETH" },
  { symbol: "rETH", address: TOKENS_ARBITRUM.rETH, category: "ETH" },
];

export const COLLATERAL_ASSETS_BASE: Array<{ symbol: string; address: Address; category: string }> = [
  { symbol: "cbBTC", address: TOKENS_BASE.cbBTC, category: "BTC" },
  { symbol: "WETH", address: TOKENS_BASE.WETH, category: "ETH" },
  { symbol: "cbETH", address: TOKENS_BASE.cbETH, category: "ETH" },
  { symbol: "wstETH", address: TOKENS_BASE.wstETH, category: "ETH" },
];

export const TOKEN_DECIMALS_ARBITRUM: Record<string, number> = {
  WBTC: 8, WETH: 18, wstETH: 18, rETH: 18,
  USDC: 6, "USDC.e": 6, USDT: 6, DAI: 18,
};

export const TOKEN_DECIMALS_BASE: Record<string, number> = {
  WETH: 18, cbETH: 18, wstETH: 18, cbBTC: 8,
  USDC: 6, USDbC: 6,
};

// ── Cache TTL configuration (seconds) ───────────────────────────────

export const CACHE_TTL = {
  rates: 120,
  marketOverview: 120,
  position: 30,
  prices: 60,
  yield: 600,
};

// ── Return types ────────────────────────────────────────────────────

export interface ProtocolRate {
  protocol: Protocol;
  chain: string;
  market: string;
  collateral: string;
  borrowAsset: string;
  supplyAPY: number;
  borrowAssetSupplyAPY: number;
  borrowAPY: number;
  availableLiquidity: number;
  availableLiquidityUSD: number;
  totalSupply: number;
  totalBorrow: number;
  utilization: number;
  maxLTV: number;
  liquidationThreshold: number;
  liquidationPenalty: number;
  lastUpdated: string;
}

export interface MarketOverview {
  protocol: Protocol;
  market: string;
  collateral: string;
  totalSupplyUSD: number;
  totalBorrowUSD: number;
  utilization: number;
  borrowAPYRange: { min: number; max: number };
  supplyAPYRange: { min: number; max: number };
}

export interface PositionData {
  protocol: Protocol;
  market: string;
  address: string;
  collateral: { asset: string; amount: number; valueUSD: number };
  debt: { asset: string; amount: number; valueUSD: number };
  currentLTV: number;
  healthFactor: number;
  liquidationPrice: number;
  distanceToLiquidation: number;
  borrowRate: number;
  estimatedAnnualCost: number;
}

export interface RiskAssessment {
  riskScore: number;
  recommendedProtocol: string;
  recommendedLTV: number;
  liquidationPrice: number;
  liquidationPenalty: number;
  distanceToLiquidation: number;
  positionSizing: {
    poolLiquidityRatio: number;
    borrowAsPoolPercent: number;
    warning: string | null;
  };
  collateralRisk: { level: string; notes: string };
  protocolRisk: { oracleType: string; liquidationMechanism: string; governance: string; notes: string };
  estimatedAnnualCost: number;
  autoUnwindRecommended: boolean;
  summary: string;
}

// ── Chain constants ──────────────────────────────────────────────────

export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  optimism: 10,
  bsc: 56,
  gnosis: 100,
  polygon: 137,
  fantom: 250,
  zksync: 324,
  base: 8453,
  arbitrum: 42161,
  avalanche: 43114,
  linea: 59144,
  scroll: 534352,
};

export const CHAIN_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(CHAIN_IDS).map(([name, id]) => [id, name])
);

// ── Swap/Bridge types ───────────────────────────────────────────────

export interface SwapQuote {
  id: string;
  fromChain: string;
  toChain: string;
  fromToken: { symbol: string; address: string; decimals: number };
  toToken: { symbol: string; address: string; decimals: number };
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  route: Array<{ type: string; tool: string; fromChain: string; toChain: string }>;
  feeCosts: Array<{ name: string; percentage: string; amountUSD: string }>;
  gasCostUSD: string;
  executionDurationSeconds: number;
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    chainId: number;
  };
  approvalNeeded: {
    tokenAddress: string;
    spender: string;
    amount: string;
  } | null;
}

export interface SwapStatus {
  status: "NOT_FOUND" | "PENDING" | "DONE" | "FAILED";
  substatus?: string;
  fromChain: string;
  toChain: string;
  bridgeName?: string;
  sendingTxHash?: string;
  receivingTxHash?: string;
  fromAmount?: string;
  toAmount?: string;
}

// ── Yield types ─────────────────────────────────────────────────────

export type YieldCategory =
  | "lending-supply"
  | "liquid-staking"
  | "vault"
  | "savings-rate"
  | "basis-capture";

export interface YieldOpportunity {
  protocol: string;
  product: string;
  asset: string;
  apy: number;
  apyType: "variable" | "fixed" | "trailing-7d" | "estimated";
  tvlUSD: number;
  category: YieldCategory;
  risk: "low" | "medium" | "high";
  riskNotes: string;
  lockup: string;
  lastUpdated: string;
  /** ISO-8601 maturity timestamp (Pendle PT/YT). */
  maturity?: string;
  /** Optional tags used by filtering: "fixed-yield", "yt", "leveraged-variable". */
  tags?: string[];
}

// ── MetaMorpho / Pendle data shapes ─────────────────────────────────

export interface VaultData {
  address: Address;
  name: string;
  curator: string;
  asset: string;
  chain: string;
  netAPY: number;
  tvlUSD: number;
  feeBps: number;
  marketCount: number;
  topMarkets: Array<{ id: string; allocation: number; collateral: string }>;
  lastUpdated: string;
}

export interface PendleMarket {
  chain: string;
  address: Address;
  name: string;
  underlying: string;
  maturity: string;
  maturityTimestamp: number;
  ptFixedAPY: number;
  ytImpliedAPY: number;
  underlyingAPY: number;
  tvlUSD: number;
  liquidityUSD: number;
  ptTokenAddress?: Address;
  ytTokenAddress?: Address;
}

export const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
export const RAY = 10n ** 27n;
export const WAD = 10n ** 18n;
