import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const MCP_URL = process.env.MCP_URL ?? "https://syenite.ai/mcp";
const LIFI_ROUTER = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";

interface BridgeTarget {
  name: string;
  toChain: string;
  toToken: string;
}

const TARGETS: BridgeTarget[] = [
  { name: "Arbitrum", toChain: "arbitrum", toToken: "ETH" },
  { name: "BNB Chain", toChain: "bsc", toToken: "BNB" },
];

async function mcpToolCall(name: string, args: Record<string, string>) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name, arguments: args },
      id: Date.now(),
    }),
  });

  const text = await res.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
  if (!dataLine) throw new Error(`No SSE data in MCP response:\n${text}`);

  const rpc = JSON.parse(dataLine.slice(6));
  if (rpc.error) throw new Error(`MCP error: ${JSON.stringify(rpc.error)}`);

  return JSON.parse(rpc.result.content[0].text);
}

async function main() {
  const rawKey = process.env.AGENT_PRIVATE_KEY?.trim();
  if (!rawKey) {
    console.error("Set AGENT_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({ chain: base, transport: http() });
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Wallet: ${account.address}`);
  console.log(`Base ETH balance: ${formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.error("No ETH on Base — nothing to bridge.");
    process.exit(1);
  }

  // Reserve gas for 2 bridge txs (~937k gas limit each, generous estimate)
  const gasPrice = await publicClient.getGasPrice();
  const gasReserve = gasPrice * 950_000n * BigInt(TARGETS.length) * 2n; // 2x safety margin
  const keepOnBase = balance / 3n;
  const bridgeBudget = balance - keepOnBase - gasReserve;
  const perBridge = bridgeBudget / BigInt(TARGETS.length);

  console.log(`Gas reserve: ${formatEther(gasReserve)} ETH`);
  console.log(`Keep on Base: ~${formatEther(keepOnBase)} ETH`);
  console.log(`Per bridge: ${formatEther(perBridge)} ETH\n`);

  if (perBridge <= 0n) {
    console.error("Balance too low to split across bridges after gas reserve.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const hashes: { name: string; hash: string; toChain: string }[] = [];

  for (const target of TARGETS) {
    console.log(`--- ${target.name} ---`);
    console.log(`Fetching bridge quote: ${formatEther(perBridge)} ETH → ${target.toToken} on ${target.toChain}...`);

    const quote = await mcpToolCall("swap.quote", {
      fromToken: "ETH",
      toToken: target.toToken,
      fromAmount: perBridge.toString(),
      fromAddress: account.address,
      fromChain: "base",
      toChain: target.toChain,
      order: "CHEAPEST",
    });

    console.log(`  Route: ${quote.summary}`);
    console.log(`  Fee: ${quote.costs.fees.map((f: any) => `${f.name} ${f.amountUSD}`).join(", ")}`);
    console.log(`  ETA: ${quote.estimatedTime}`);

    const tx = quote.execution.transactionRequest;

    if (dryRun) {
      console.log(`  DRY RUN — would send tx to ${tx.to} with value ${tx.value}\n`);
      continue;
    }

    console.log("  Submitting transaction...");
    const hash = await walletClient.sendTransaction({
      to: tx.to as Hex,
      data: tx.data as Hex,
      value: BigInt(tx.value),
      gas: BigInt(tx.gasLimit),
    });

    console.log(`  TX: https://basescan.org/tx/${hash}`);
    hashes.push({ name: target.name, hash, toChain: target.toChain });
    console.log();
  }

  if (dryRun) {
    console.log("Run without --dry-run to submit transactions.");
    return;
  }

  // Wait for Base confirmations
  console.log("Waiting for Base confirmations...\n");
  for (const { name, hash } of hashes) {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: hash as Hex,
    });
    console.log(
      `${name}: ${receipt.status === "success" ? "CONFIRMED" : "FAILED"} (block ${receipt.blockNumber})`
    );
  }

  const remaining = await publicClient.getBalance({ address: account.address });
  console.log(`\nRemaining Base balance: ${formatEther(remaining)} ETH`);

  console.log("\nBridge transactions submitted. Cross-chain delivery takes ~1 min.");
  console.log("Track status with swap.status or check destination explorers:");
  for (const { name, hash, toChain } of hashes) {
    console.log(`  ${name}: swap.status(txHash="${hash}", fromChain="base", toChain="${toChain}")`);
  }

  console.log("\nOnce funds arrive, register agents:");
  console.log("  npm run register-agent:arbitrum");
  console.log("  npm run register-agent:bnb");
}

main().catch((e) => {
  console.error("Bridge failed:", e.message ?? e);
  process.exit(1);
});
