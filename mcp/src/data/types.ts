import { getAddress, type Address } from "viem";

// ── Protocol types ──────────────────────────────────────────────────

export type Protocol = "aave-v3" | "morpho-blue" | "spark" | "compound-v3" | "euler-v2" | "liquity-v2";

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
  {
    id: "0x3a85e619751152991742810df6ec69ce473daef99e28a64ab2340d7b7ccfee49",
    loanToken: TOKENS.USDC,
    collateralToken: TOKENS.WETH,
    oracle: getAddress("0xfb4abcaefb08b4cee8d0a02f3f3b2b4b0f5b6d4e"),
    irm: MORPHO.adaptiveCurveIrm,
    lltv: 860000000000000000n,
    label: "WETH/USDC (86% LLTV)",
  },
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

/** Pendle PT markets (Ethereum mainnet, current active maturities) */
export const PENDLE_MARKETS: Array<{ market: Address; pt: Address; label: string; asset: string; maturity: string }> = [
  {
    market: getAddress("0x08bf93c8f85977c64069dd34c5da7b1c636e104f"),
    pt: getAddress("0xe8483517077afa11a9b07f849cee2552f040d7b2"),
    label: "PT sUSDe Feb 2026",
    asset: "USDe",
    maturity: "2026-02-05",
  },
];

// ── Cache TTL configuration (seconds) ───────────────────────────────

export const CACHE_TTL = {
  rates: 30,
  marketOverview: 60,
  position: 15,
  prices: 30,
  yield: 60,
};

// ── Return types ────────────────────────────────────────────────────

export interface ProtocolRate {
  protocol: Protocol;
  market: string;
  collateral: string;
  borrowAsset: string;
  supplyAPY: number;
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

// ── Yield types ─────────────────────────────────────────────────────

export type YieldCategory =
  | "lending-supply"
  | "liquid-staking"
  | "vault"
  | "savings-rate"
  | "basis-capture"
  | "fixed-yield";

export interface YieldOpportunity {
  protocol: string;
  product: string;
  asset: string;
  apy: number;
  apyType: "variable" | "fixed" | "trailing-7d";
  tvlUSD: number;
  category: YieldCategory;
  risk: "low" | "medium" | "high";
  riskNotes: string;
  lockup: string;
  lastUpdated: string;
}

export const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60;
export const RAY = 10n ** 27n;
export const WAD = 10n ** 18n;
