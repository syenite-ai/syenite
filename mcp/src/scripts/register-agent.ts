import "dotenv/config";
import { createWalletClient, http, encodeFunctionData, type Chain } from "viem";
import { base, mainnet, arbitrum, bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { agentRegistrationJson } from "../web/agent-registration.js";

const REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

const CHAINS: Record<string, { chain: Chain; explorer: string }> = {
  base: { chain: base, explorer: "https://basescan.org" },
  ethereum: { chain: mainnet, explorer: "https://etherscan.io" },
  arbitrum: { chain: arbitrum, explorer: "https://arbiscan.io" },
  bnb: { chain: bsc, explorer: "https://bscscan.com" },
};

const REGISTER_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

async function main() {
  const rawKey = process.env.AGENT_PRIVATE_KEY?.trim();
  if (!rawKey) {
    console.error("Set AGENT_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const chainArg = process.argv.find((a) => a.startsWith("--chain="))?.split("=")[1] ?? "base";
  const target = CHAINS[chainArg];
  if (!target) {
    console.error(`Unknown chain: ${chainArg}. Available: ${Object.keys(CHAINS).join(", ")}`);
    process.exit(1);
  }

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  console.log(`Registering agent from wallet: ${account.address}`);
  console.log(`Chain: ${target.chain.name} (${target.chain.id})`);
  console.log(`Registry: ${REGISTRY_ADDRESS}\n`);

  const metadata = agentRegistrationJson();
  const jsonStr = JSON.stringify(metadata);
  const b64 = Buffer.from(jsonStr).toString("base64");
  const dataUri = `data:application/json;base64,${b64}`;

  console.log("Agent metadata:");
  console.log(`  Name: ${metadata.name}`);
  console.log(`  Services: ${metadata.services.map((s) => s.name).join(", ")}`);
  console.log(`  x402 support: ${metadata.x402Support}`);
  console.log(`  URI size: ${dataUri.length} bytes\n`);

  const client = createWalletClient({
    account,
    chain: target.chain,
    transport: http(),
  });

  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("DRY RUN — would send register() with data URI:");
    console.log(`  ${dataUri.slice(0, 80)}...`);
    console.log("\nRun without --dry-run to submit the transaction.");
    return;
  }

  console.log("Sending register() transaction...");
  const hash = await client.sendTransaction({
    to: REGISTRY_ADDRESS,
    data: encodeFunctionData({
      abi: REGISTER_ABI,
      functionName: "register",
      args: [dataUri],
    }),
  });

  console.log(`Transaction submitted: ${hash}`);
  console.log(`View: ${target.explorer}/tx/${hash}`);
  console.log(
    `\nAfter confirmation, find your Agent ID at:`,
    `${target.explorer}/address/${account.address}#nfttransfers`
  );
  console.log(
    "\nThen set AGENT_ID in .env and redeploy to populate",
    "/.well-known/agent-registration.json"
  );
}

main().catch((e) => {
  console.error("Registration failed:", e.message ?? e);
  process.exit(1);
});
