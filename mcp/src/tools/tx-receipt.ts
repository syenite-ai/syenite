import { formatEther, formatGwei, type Hex } from "viem";
import { getClient, type SupportedChain, ALL_LENDING_CHAINS } from "../data/client.js";
import { SyeniteError } from "../errors.js";

export const txReceiptDescription = `Fetch and decode a transaction receipt from any supported chain.
Returns success/failure, gas used, gas cost in native + USD, block number, contract interactions, and decoded event logs.
Use after submitting any transaction (swap, supply, borrow, bridge) to confirm execution.
Essential for closing the strategy → quote → sign → verify loop.`;

const CHAIN_MAP: Record<string, SupportedChain> = {
  ethereum: "ethereum",
  eth: "ethereum",
  "1": "ethereum",
  arbitrum: "arbitrum",
  arb: "arbitrum",
  "42161": "arbitrum",
  base: "base",
  "8453": "base",
  bsc: "bsc",
  bnb: "bsc",
  "56": "bsc",
};

const CHAIN_EXPLORERS: Record<SupportedChain, string> = {
  ethereum: "https://etherscan.io",
  arbitrum: "https://arbiscan.io",
  base: "https://basescan.org",
  bsc: "https://bscscan.com",
  optimism: "https://optimistic.etherscan.io",
};

const NATIVE_SYMBOLS: Record<SupportedChain, string> = {
  ethereum: "ETH",
  arbitrum: "ETH",
  base: "ETH",
  bsc: "BNB",
  optimism: "ETH",
};

const NATIVE_PRICES: Record<SupportedChain, number> = {
  ethereum: 3500,
  arbitrum: 3500,
  base: 3500,
  bsc: 600,
  optimism: 3500,
};

const KNOWN_EVENTS: Record<string, string> = {
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": "Transfer",
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925": "Approval",
  "0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c": "Deposit",
  "0x7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65": "Withdrawal",
  "0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61": "Supply (Aave)",
  "0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0": "Borrow (Aave)",
  "0x3115d1449a7b732c986cba18244e897a145df0b3b24b46c4dbdf2eef500099c7": "Withdraw (Aave)",
  "0xa534c8dbe71f871f9f3f77571f15f067af254a02ed17c201b13d8c1e1d9842c1": "Repay (Aave)",
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822": "Swap (DEX)",
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67": "Swap (Uniswap V3)",
};

function resolveChain(chain: string): SupportedChain {
  const resolved = CHAIN_MAP[chain.toLowerCase()];
  if (!resolved) {
    throw SyeniteError.invalidInput(
      `Unsupported chain: ${chain}. Supported: ${ALL_LENDING_CHAINS.join(", ")}`
    );
  }
  return resolved;
}

function decodeEventTopic(topic: string): string {
  return KNOWN_EVENTS[topic.toLowerCase()] ?? "Unknown";
}

export async function handleTxReceipt(params: {
  txHash: string;
  chain?: string;
}): Promise<Record<string, unknown>> {
  const chain = resolveChain(params.chain ?? "ethereum");
  const client = getClient(chain);
  const txHash = params.txHash as Hex;

  const [receipt, tx] = await Promise.all([
    client.getTransactionReceipt({ hash: txHash }).catch(() => null),
    client.getTransaction({ hash: txHash }).catch(() => null),
  ]);

  if (!receipt) {
    throw SyeniteError.invalidInput(
      `Transaction ${params.txHash} not found on ${chain}. It may be pending or on a different chain.`
    );
  }

  const gasUsed = Number(receipt.gasUsed);
  const effectiveGasPrice = receipt.effectiveGasPrice ?? 0n;
  const gasCostWei = receipt.gasUsed * effectiveGasPrice;
  const gasCostNative = formatEther(gasCostWei);
  const nativeSymbol = NATIVE_SYMBOLS[chain];
  const nativePrice = NATIVE_PRICES[chain];
  const gasCostUSD = (parseFloat(gasCostNative) * nativePrice).toFixed(2);

  const contractsInteracted = new Set<string>();
  contractsInteracted.add(receipt.to ?? "contract creation");
  for (const logEntry of receipt.logs) {
    contractsInteracted.add(logEntry.address);
  }

  const decodedLogs = receipt.logs.slice(0, 20).map((logEntry) => {
    const eventName = logEntry.topics[0]
      ? decodeEventTopic(logEntry.topics[0])
      : "Unknown";
    return {
      address: logEntry.address,
      event: eventName,
      topicCount: logEntry.topics.length,
      logIndex: logEntry.logIndex,
    };
  });

  const transferLogs = receipt.logs.filter(
    (l) =>
      l.topics[0]?.toLowerCase() ===
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
  );

  const tokenTransfers = transferLogs.slice(0, 10).map((l) => {
    const from = l.topics[1] ? ("0x" + l.topics[1].slice(26)) : "unknown";
    const to = l.topics[2] ? ("0x" + l.topics[2].slice(26)) : "unknown";
    return {
      token: l.address,
      from,
      to,
      rawValue: l.data,
    };
  });

  const explorer = CHAIN_EXPLORERS[chain];
  const explorerUrl = `${explorer}/tx/${params.txHash}`;

  return {
    txHash: params.txHash,
    chain,
    status: receipt.status === "success" ? "confirmed" : "reverted",
    success: receipt.status === "success",
    blockNumber: Number(receipt.blockNumber),
    from: receipt.from,
    to: receipt.to ?? "contract creation",
    nonce: tx ? Number(tx.nonce) : null,
    gas: {
      gasUsed,
      gasLimit: tx ? Number(tx.gas) : null,
      effectiveGasPrice: `${formatGwei(effectiveGasPrice)} gwei`,
      costNative: `${gasCostNative} ${nativeSymbol}`,
      costUSD: `$${gasCostUSD}`,
    },
    value: tx ? formatEther(tx.value) + ` ${nativeSymbol}` : "0",
    contractsInteracted: Array.from(contractsInteracted),
    logs: {
      totalEvents: receipt.logs.length,
      decoded: decodedLogs,
    },
    tokenTransfers: tokenTransfers.length > 0 ? tokenTransfers : undefined,
    explorerUrl,
    timestamp: new Date().toISOString(),
    note: "Transaction receipt fetched on-chain and decoded. Use lending.position.monitor to check updated position state. — syenite.ai",
  };
}
