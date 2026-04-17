export interface SolanaMarketRate {
  protocol: string;
  chain: "solana";
  reserve: string;
  market: string;
  asset: string;
  supplyAPY: number;
  borrowAPY: number;
  utilization: number;
  tvlUSD: number;
  liquidityUSD: number;
}

export interface SolanaStakingYield {
  protocol: string;
  product: string;
  asset: string;
  apy: number;
  tvlUSD: number;
}

export const SOLANA_CACHE_TTL = {
  markets: 60,
  staking: 120,
  lst: 120,
  drift: 60,
  jupiterQuote: 15,
};
