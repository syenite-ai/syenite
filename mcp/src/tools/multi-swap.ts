import { handleSwapQuote } from "./swap.js";
import { SyeniteError } from "../errors.js";

export const swapMultiDescription = `Fetches up to 10 swap or bridge quotes in a single batched call, executing all route lookups in parallel and returning each result alongside a total cost summary. Use this when splitting funds across multiple chains, executing multi-leg portfolio rebalancing, or comparing routes side-by-side without making sequential calls. Each element in the requests array accepts the same parameters as swap.quote (fromToken, toToken, fromAmount, fromAddress, fromChain, toChain, slippage, order). Returns per-request results with status ok or error (failed quotes do not abort the batch), plus aggregate gas and fee totals. Quotes are valid for approximately 30 seconds; sign and submit transactions sequentially to avoid nonce conflicts. Maximum 10 requests per call.`;

interface SwapRequest {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  fromChain?: string;
  toChain?: string;
  slippage?: number;
  order?: string;
}

export async function handleSwapMulti(params: {
  requests: SwapRequest[];
}): Promise<Record<string, unknown>> {
  const { requests } = params;

  if (!requests || requests.length === 0) {
    throw SyeniteError.invalidInput("requests array is required and must not be empty");
  }

  if (requests.length > 10) {
    throw SyeniteError.invalidInput("Maximum 10 requests per batch");
  }

  const results = await Promise.allSettled(
    requests.map((req) => handleSwapQuote(req))
  );

  const quotes: Array<Record<string, unknown>> = [];
  let totalFeesUSD = 0;
  let totalGasUSD = 0;
  let successCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      quotes.push({ index: i, status: "ok", ...result.value });
      successCount++;
      const costs = result.value.costs as { gasCostUSD: string; fees: Array<{ amountUSD: string }> } | undefined;
      if (costs) {
        totalGasUSD += parseFloat(costs.gasCostUSD.replace("$", ""));
        for (const fee of costs.fees) {
          totalFeesUSD += parseFloat(fee.amountUSD.replace("$", ""));
        }
      }
    } else {
      const msg = result.reason instanceof Error ? result.reason.message : "Unknown error";
      quotes.push({ index: i, status: "error", error: msg });
    }
  }

  return {
    requestCount: requests.length,
    successCount,
    failedCount: requests.length - successCount,
    totalCosts: {
      gasCostUSD: `$${totalGasUSD.toFixed(2)}`,
      feesUSD: `$${totalFeesUSD.toFixed(2)}`,
      totalUSD: `$${(totalGasUSD + totalFeesUSD).toFixed(2)}`,
    },
    quotes,
    timestamp: new Date().toISOString(),
    note: "All quotes fetched in parallel. Each quote is valid for ~30 seconds. Sign and submit transactions sequentially to avoid nonce conflicts. — syenite.ai",
  };
}
