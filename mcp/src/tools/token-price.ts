import { getTokenPrice } from "../data/prices.js";
import { TOKEN_PRICE_FEED } from "../data/types.js";
import { SyeniteError } from "../errors.js";

export const tokenPriceDescription = `Get the current USD price for a supported token via Chainlink on-chain oracle.
Prices are the same feeds used by Aave, Morpho, Spark, and other lending protocols — what Chainlink reports is what determines liquidation.
Supported tokens: ${Object.keys(TOKEN_PRICE_FEED).join(", ")}.
Cached for 60 seconds. Use for portfolio valuation, P&L calculation, and policy enforcement.`;

export async function handleTokenPrice(params: {
  symbol: string;
  symbols?: string[];
}): Promise<Record<string, unknown>> {
  const requested = params.symbols?.length
    ? params.symbols
    : [params.symbol];

  if (requested.length === 0) {
    throw SyeniteError.invalidInput("Provide at least one token symbol.");
  }
  if (requested.length > 20) {
    throw SyeniteError.invalidInput("Maximum 20 tokens per request.");
  }

  const results = await Promise.allSettled(
    requested.map(async (sym) => {
      const price = await getTokenPrice(sym);
      return { symbol: sym, priceUSD: price, feed: TOKEN_PRICE_FEED[sym] ?? null };
    })
  );

  const prices: Array<{ symbol: string; priceUSD: number; feed: string | null }> = [];
  const errors: Array<{ symbol: string; error: string }> = [];

  for (const r of results) {
    if (r.status === "fulfilled") {
      prices.push(r.value);
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      const sym = requested[results.indexOf(r)];
      errors.push({ symbol: sym, error: msg });
    }
  }

  return {
    prices,
    errors: errors.length > 0 ? errors : undefined,
    supportedTokens: Object.keys(TOKEN_PRICE_FEED),
    source: "Chainlink on-chain oracles (same feeds used by lending protocols)",
    timestamp: new Date().toISOString(),
  };
}
