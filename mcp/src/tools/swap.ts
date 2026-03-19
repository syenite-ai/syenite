import { getLifiQuote, getLifiStatus } from "../data/lifi.js";
import { CHAIN_IDS, type SwapQuote } from "../data/types.js";

export const swapQuoteDescription = `Get an optimal swap or bridge quote with unsigned transaction calldata.
Supports same-chain swaps and cross-chain bridges across 30+ chains via aggregated routing (1inch, 0x, Paraswap, and more).
Returns the best route, expected output, fee breakdown, and an unsigned transaction ready to sign. The agent or user handles signing — Syenite never touches private keys.
For cross-chain transfers, this handles bridging automatically — no separate bridge step needed.`;

export const swapStatusDescription = `Track execution status of a swap or cross-chain bridge transaction.
Returns current status (PENDING, DONE, FAILED), receiving transaction hash, and amount received.
Useful for monitoring cross-chain bridges where execution is not instant.`;

const KNOWN_STABLECOINS = new Set([
  "usdc", "usdt", "dai", "gho", "usde", "susde", "lusd", "frax", "busd", "tusd",
]);

function formatTokenAmount(raw: string, decimals: number): string {
  if (!raw || raw === "0") return "0";
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals) || "0";
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

function computePriceImpact(quote: SwapQuote): number | null {
  const fromSym = quote.fromToken.symbol.toLowerCase();
  const toSym = quote.toToken.symbol.toLowerCase();
  const fromIsStable = KNOWN_STABLECOINS.has(fromSym);
  const toIsStable = KNOWN_STABLECOINS.has(toSym);
  if (fromIsStable && toIsStable) {
    const fromAmt = parseFloat(formatTokenAmount(quote.fromAmount, quote.fromToken.decimals));
    const toAmt = parseFloat(formatTokenAmount(quote.toAmount, quote.toToken.decimals));
    if (fromAmt > 0 && toAmt > 0) {
      return ((fromAmt - toAmt) / fromAmt) * 100;
    }
  }
  return null;
}

function riskWarnings(quote: SwapQuote): string[] {
  const warnings: string[] = [];

  const priceImpact = computePriceImpact(quote);
  if (priceImpact !== null && priceImpact > 1) {
    warnings.push(`High price impact: ${priceImpact.toFixed(2)}% — consider smaller trade size`);
  }

  const gasCost = parseFloat(quote.gasCostUSD);
  const fromAmount = parseFloat(formatTokenAmount(quote.fromAmount, quote.fromToken.decimals));
  if (gasCost > 0 && fromAmount > 0 && gasCost / fromAmount > 0.05) {
    warnings.push(`Gas cost is ${((gasCost / fromAmount) * 100).toFixed(1)}% of trade value — small trade relative to gas`);
  }

  if (quote.route.some((s) => s.type === "cross")) {
    warnings.push("Cross-chain transfer — execution is not instant. Use swap.status to track progress.");
  }

  if (quote.executionDurationSeconds > 600) {
    const mins = Math.round(quote.executionDurationSeconds / 60);
    warnings.push(`Estimated execution time: ${mins} minutes. Cross-chain bridges can take longer under congestion.`);
  }

  return warnings;
}

export async function handleSwapQuote(params: {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  fromChain?: string;
  toChain?: string;
  slippage?: number;
  order?: string;
}): Promise<Record<string, unknown>> {
  const fromChain = params.fromChain ?? "ethereum";
  const toChain = params.toChain ?? fromChain;
  const order = (params.order ?? "CHEAPEST").toUpperCase() as "CHEAPEST" | "FASTEST";

  const quote = await getLifiQuote({
    fromChain,
    toChain,
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    slippage: params.slippage,
    order,
  });

  const fromAmountFmt = formatTokenAmount(quote.fromAmount, quote.fromToken.decimals);
  const toAmountFmt = formatTokenAmount(quote.toAmount, quote.toToken.decimals);
  const toAmountMinFmt = formatTokenAmount(quote.toAmountMin, quote.toToken.decimals);
  const isCrossChain = quote.fromChain !== quote.toChain;
  const warnings = riskWarnings(quote);

  const routeSteps = quote.route.map((s, i) =>
    `${i + 1}. ${s.type} via ${s.tool}${s.fromChain !== s.toChain ? ` (${s.fromChain} → ${s.toChain})` : ""}`
  );

  const result: Record<string, unknown> = {
    type: isCrossChain ? "bridge" : "swap",
    summary: `${fromAmountFmt} ${quote.fromToken.symbol} → ${toAmountFmt} ${quote.toToken.symbol}${isCrossChain ? ` (${quote.fromChain} → ${quote.toChain})` : ""}`,
    quote: {
      fromToken: quote.fromToken.symbol,
      toToken: quote.toToken.symbol,
      fromAmount: fromAmountFmt,
      expectedOutput: toAmountFmt,
      minimumOutput: toAmountMinFmt,
      fromChain: quote.fromChain,
      toChain: quote.toChain,
    },
    route: routeSteps,
    costs: {
      gasCostUSD: `$${quote.gasCostUSD}`,
      fees: quote.feeCosts.map((f) => ({
        name: f.name,
        percentage: `${(parseFloat(f.percentage) * 100).toFixed(2)}%`,
        amountUSD: `$${f.amountUSD}`,
      })),
    },
    estimatedTime: quote.executionDurationSeconds > 0
      ? `${Math.ceil(quote.executionDurationSeconds / 60)} min`
      : "instant",
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  result.execution = {
    instructions: "Sign and submit the transaction below from your wallet. Syenite does not hold private keys.",
    transactionRequest: quote.transactionRequest,
  };

  if (quote.approvalNeeded) {
    result.approvalRequired = {
      note: `Token approval required before swap. Approve ${quote.fromToken.symbol} spending for the router contract.`,
      tokenAddress: quote.approvalNeeded.tokenAddress,
      spender: quote.approvalNeeded.spender,
      amount: quote.approvalNeeded.amount,
    };
  }

  if (isCrossChain) {
    result.tracking = "After submitting, use swap.status with the transaction hash to track cross-chain execution.";
  }

  result.note = "Route sourced via Li.Fi aggregation (1inch, 0x, Paraswap, bridges). Quotes are valid for ~30 seconds. Re-query for fresh pricing. — syenite.ai";

  return result;
}

export async function handleSwapStatus(params: {
  txHash: string;
  fromChain?: string;
  toChain?: string;
}): Promise<Record<string, unknown>> {
  const fromChain = params.fromChain ?? "ethereum";
  const toChain = params.toChain ?? fromChain;

  const status = await getLifiStatus({
    txHash: params.txHash,
    fromChain,
    toChain,
  });

  const result: Record<string, unknown> = {
    status: status.status,
    ...(status.substatus && { substatus: status.substatus }),
    fromChain: status.fromChain,
    toChain: status.toChain,
    sendingTxHash: status.sendingTxHash ?? params.txHash,
  };

  if (status.receivingTxHash) {
    result.receivingTxHash = status.receivingTxHash;
  }

  if (status.toAmount) {
    result.amountReceived = status.toAmount;
  }

  if (status.bridgeName) {
    result.bridge = status.bridgeName;
  }

  const statusMessages: Record<string, string> = {
    NOT_FOUND: "Transaction not found. It may not have been submitted yet, or the chain/hash combination is incorrect.",
    PENDING: "Transaction is in progress. Cross-chain bridges can take 2-30 minutes depending on the route. Check again shortly.",
    DONE: "Transfer complete. Funds have arrived at the destination.",
    FAILED: "Transfer failed. Check the sending transaction for revert reasons. Funds may need to be recovered.",
  };
  result.message = statusMessages[status.status] ?? "Unknown status.";

  result.note = "Status tracked via Li.Fi bridge monitoring. — syenite.ai";

  return result;
}
