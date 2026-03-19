import { CHAIN_IDS, CHAIN_NAMES, type SwapQuote, type SwapStatus } from "./types.js";

const LIFI_BASE = "https://li.quest/v1";

function getIntegrator(): string {
  return process.env.LIFI_INTEGRATOR ?? "syenite";
}

function getIntegratorFee(): number {
  const fee = process.env.LIFI_FEE;
  return fee ? parseFloat(fee) : 0;
}

function resolveChainId(chain: string): number {
  const lower = chain.toLowerCase();
  if (CHAIN_IDS[lower] !== undefined) return CHAIN_IDS[lower];
  const asNum = parseInt(chain, 10);
  if (!isNaN(asNum)) return asNum;
  throw new Error(`Unknown chain: "${chain}". Supported: ${Object.keys(CHAIN_IDS).join(", ")}`);
}

function chainName(id: number): string {
  return CHAIN_NAMES[id] ?? `chain-${id}`;
}

export async function getLifiQuote(params: {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  slippage?: number;
  order?: "CHEAPEST" | "FASTEST";
}): Promise<SwapQuote> {
  const fromChainId = resolveChainId(params.fromChain);
  const toChainId = resolveChainId(params.toChain);
  const slippage = params.slippage ?? 0.005;
  const order = params.order ?? "CHEAPEST";
  const integrator = getIntegrator();
  const fee = getIntegratorFee();

  const qs = new URLSearchParams({
    fromChain: fromChainId.toString(),
    toChain: toChainId.toString(),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    slippage: slippage.toString(),
    order,
    integrator,
    ...(fee > 0 && { fee: fee.toString() }),
    ...(params.toAddress && { toAddress: params.toAddress }),
  });

  const resp = await fetch(`${LIFI_BASE}/quote?${qs.toString()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const body = await resp.text();
    let message = `Li.Fi API error (${resp.status})`;
    try {
      const parsed = JSON.parse(body);
      message = parsed.message ?? message;
    } catch {}
    throw new Error(message);
  }

  const data = await resp.json();

  const feeCosts = (data.estimate?.feeCosts ?? []).map((f: Record<string, unknown>) => ({
    name: f.name ?? "fee",
    percentage: String(f.percentage ?? "0"),
    amountUSD: String(f.amountUSD ?? "0"),
  }));

  const gasCostUSD = (data.estimate?.gasCosts ?? [])
    .reduce((sum: number, g: Record<string, unknown>) => sum + parseFloat(String(g.amountUSD ?? "0")), 0)
    .toFixed(2);

  const route = extractRoute(data);

  const approvalNeeded = data.estimate?.approvalAddress && data.action?.fromToken?.address
    ? {
        tokenAddress: data.action.fromToken.address as string,
        spender: data.estimate.approvalAddress as string,
        amount: params.fromAmount,
      }
    : null;

  return {
    id: data.id ?? crypto.randomUUID(),
    fromChain: chainName(fromChainId),
    toChain: chainName(toChainId),
    fromToken: {
      symbol: data.action?.fromToken?.symbol ?? params.fromToken,
      address: data.action?.fromToken?.address ?? params.fromToken,
      decimals: data.action?.fromToken?.decimals ?? 18,
    },
    toToken: {
      symbol: data.action?.toToken?.symbol ?? params.toToken,
      address: data.action?.toToken?.address ?? params.toToken,
      decimals: data.action?.toToken?.decimals ?? 18,
    },
    fromAmount: data.action?.fromAmount ?? params.fromAmount,
    toAmount: data.estimate?.toAmount ?? "0",
    toAmountMin: data.estimate?.toAmountMin ?? "0",
    route,
    feeCosts,
    gasCostUSD,
    executionDurationSeconds: data.estimate?.executionDuration ?? 0,
    transactionRequest: {
      to: data.transactionRequest?.to ?? "",
      data: data.transactionRequest?.data ?? "",
      value: data.transactionRequest?.value ?? "0x0",
      gasLimit: data.transactionRequest?.gasLimit ?? "",
      chainId: fromChainId,
    },
    approvalNeeded,
  };
}

function extractRoute(data: Record<string, unknown>): SwapQuote["route"] {
  const steps: SwapQuote["route"] = [];

  const includedSteps = data.includedSteps as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(includedSteps)) {
    for (const step of includedSteps) {
      steps.push({
        type: String(step.type ?? "unknown"),
        tool: String(step.tool ?? "unknown"),
        fromChain: chainName(Number(step.action && (step.action as Record<string, unknown>).fromChainId) || 0),
        toChain: chainName(Number(step.action && (step.action as Record<string, unknown>).toChainId) || 0),
      });
    }
  }

  if (steps.length === 0) {
    steps.push({
      type: String(data.type ?? "swap"),
      tool: String(data.tool ?? "unknown"),
      fromChain: chainName(Number((data.action as Record<string, unknown>)?.fromChainId) || 0),
      toChain: chainName(Number((data.action as Record<string, unknown>)?.toChainId) || 0),
    });
  }

  return steps;
}

export async function getLifiStatus(params: {
  txHash: string;
  fromChain: string;
  toChain: string;
}): Promise<SwapStatus> {
  const fromChainId = resolveChainId(params.fromChain);
  const toChainId = resolveChainId(params.toChain);

  const qs = new URLSearchParams({
    txHash: params.txHash,
    fromChain: fromChainId.toString(),
    toChain: toChainId.toString(),
  });

  const resp = await fetch(`${LIFI_BASE}/status?${qs.toString()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const body = await resp.text();
    let message = `Li.Fi status API error (${resp.status})`;
    try {
      const parsed = JSON.parse(body);
      message = parsed.message ?? message;
    } catch {}
    throw new Error(message);
  }

  const data = await resp.json();

  return {
    status: data.status ?? "NOT_FOUND",
    substatus: data.substatus,
    fromChain: chainName(fromChainId),
    toChain: chainName(toChainId),
    bridgeName: data.tool,
    sendingTxHash: data.sending?.txHash,
    receivingTxHash: data.receiving?.txHash,
    fromAmount: data.sending?.amount,
    toAmount: data.receiving?.amount,
  };
}
