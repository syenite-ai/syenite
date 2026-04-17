import { cacheGet, cacheSet } from "../cache.js";
import { fetchJson } from "./http.js";
import { SOLANA_CACHE_TTL } from "./types.js";

const JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP_URL = "https://quote-api.jup.ag/v6/swap";

export interface JupiterQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo?: {
      ammKey?: string;
      label?: string;
      inputMint?: string;
      outputMint?: string;
      inAmount?: string;
      outAmount?: string;
      feeAmount?: string;
      feeMint?: string;
    };
    percent?: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

export async function getJupiterQuote(
  params: JupiterQuoteParams,
): Promise<JupiterQuote | null> {
  const slippageBps = params.slippageBps ?? 50;
  const cacheKey = `solana:jupiter:quote:${params.inputMint}:${params.outputMint}:${params.amount}:${slippageBps}`;
  const cached = await cacheGet<JupiterQuote>(cacheKey);
  if (cached) return cached;

  const qs = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amount,
    slippageBps: slippageBps.toString(),
    onlyDirectRoutes: "false",
  });

  const data = await fetchJson<JupiterQuote>(`${JUPITER_QUOTE_URL}?${qs.toString()}`, {
    label: "jupiter:quote",
    timeoutMs: 15_000,
  });

  if (!data || !data.outAmount) return null;
  await cacheSet(cacheKey, data, SOLANA_CACHE_TTL.jupiterQuote);
  return data;
}

export interface JupiterSwapTxResponse {
  swapTransaction: string;
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: number;
}

export async function getJupiterSwapTransaction(args: {
  quote: JupiterQuote;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
}): Promise<JupiterSwapTxResponse | null> {
  try {
    const resp = await fetch(JUPITER_SWAP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        quoteResponse: args.quote,
        userPublicKey: args.userPublicKey,
        wrapAndUnwrapSol: args.wrapAndUnwrapSol ?? true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as JupiterSwapTxResponse;
  } catch {
    return null;
  }
}
