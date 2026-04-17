export interface SolanaToken {
  symbol: string;
  mint: string;
  decimals: number;
  name: string;
}

/**
 * Curated top-30 Solana SPL tokens with canonical mint addresses.
 * Source: Jupiter token list (hardcoded to avoid runtime fetch of full list).
 * Covers native SOL (wSOL), stablecoins, LSTs, and major memes.
 */
export const SOLANA_TOKENS: Record<string, SolanaToken> = {
  SOL: {
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    name: "Wrapped SOL",
  },
  WSOL: {
    symbol: "wSOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    name: "Wrapped SOL",
  },
  USDC: {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    name: "USD Coin",
  },
  USDT: {
    symbol: "USDT",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    name: "Tether USD",
  },
  MSOL: {
    symbol: "mSOL",
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    decimals: 9,
    name: "Marinade staked SOL",
  },
  JITOSOL: {
    symbol: "jitoSOL",
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    decimals: 9,
    name: "Jito Staked SOL",
  },
  BSOL: {
    symbol: "bSOL",
    mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
    decimals: 9,
    name: "BlazeStake Staked SOL",
  },
  JUPSOL: {
    symbol: "jupSOL",
    mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
    decimals: 9,
    name: "Jupiter Staked SOL",
  },
  INF: {
    symbol: "INF",
    mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
    decimals: 9,
    name: "Infinity (Sanctum LST)",
  },
  JUP: {
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    name: "Jupiter",
  },
  BONK: {
    symbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    name: "Bonk",
  },
  PYTH: {
    symbol: "PYTH",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    decimals: 6,
    name: "Pyth Network",
  },
  JTO: {
    symbol: "JTO",
    mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    decimals: 9,
    name: "Jito",
  },
  WIF: {
    symbol: "WIF",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    decimals: 6,
    name: "dogwifhat",
  },
  RAY: {
    symbol: "RAY",
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    decimals: 6,
    name: "Raydium",
  },
  ORCA: {
    symbol: "ORCA",
    mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    decimals: 6,
    name: "Orca",
  },
  DRIFT: {
    symbol: "DRIFT",
    mint: "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7",
    decimals: 6,
    name: "Drift",
  },
  KMNO: {
    symbol: "KMNO",
    mint: "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS",
    decimals: 6,
    name: "Kamino",
  },
  MNDE: {
    symbol: "MNDE",
    mint: "MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey",
    decimals: 9,
    name: "Marinade",
  },
  RENDER: {
    symbol: "RENDER",
    mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    decimals: 8,
    name: "Render",
  },
  PYUSD: {
    symbol: "PYUSD",
    mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    decimals: 6,
    name: "PayPal USD",
  },
  USDS: {
    symbol: "USDS",
    mint: "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
    decimals: 6,
    name: "USDS",
  },
  WBTC: {
    symbol: "wBTC",
    mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
    decimals: 8,
    name: "Wrapped BTC (Portal)",
  },
  WETH: {
    symbol: "wETH",
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    decimals: 8,
    name: "Wrapped ETH (Portal)",
  },
  JLP: {
    symbol: "JLP",
    mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
    decimals: 6,
    name: "Jupiter LP",
  },
  HSOL: {
    symbol: "hSOL",
    mint: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A",
    decimals: 9,
    name: "Helius Staked SOL",
  },
  PICOSOL: {
    symbol: "picoSOL",
    mint: "picobAEvs6w7QEknPce34wAE4gknZA9v5tTonnmHYdX",
    decimals: 9,
    name: "picoSOL",
  },
  COMPASSSOL: {
    symbol: "compassSOL",
    mint: "Comp4ssDzXcLeu2MnLuGNNFC4cmLPMng8qWHPvzAMU1h",
    decimals: 9,
    name: "Compass SOL",
  },
  DSOL: {
    symbol: "dSOL",
    mint: "Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ",
    decimals: 9,
    name: "Drift Staked SOL",
  },
  VSOL: {
    symbol: "vSOL",
    mint: "Vote111111111111111111111111111111111111111",
    decimals: 9,
    name: "The Vault staked SOL",
  },
};

const MINT_TO_SYMBOL: Map<string, string> = new Map(
  Object.values(SOLANA_TOKENS).map((t) => [t.mint, t.symbol]),
);

export function getSolanaToken(symbol: string): SolanaToken | null {
  if (!symbol) return null;
  const key = symbol.toUpperCase();
  return SOLANA_TOKENS[key] ?? null;
}

export function resolveMint(address: string): SolanaToken | null {
  if (!address) return null;
  const symbol = MINT_TO_SYMBOL.get(address);
  if (!symbol) return null;
  const key = symbol.toUpperCase();
  return SOLANA_TOKENS[key] ?? null;
}

export function listSolanaTokens(): SolanaToken[] {
  const seen = new Set<string>();
  const out: SolanaToken[] = [];
  for (const t of Object.values(SOLANA_TOKENS)) {
    if (seen.has(t.mint)) continue;
    seen.add(t.mint);
    out.push(t);
  }
  return out;
}
