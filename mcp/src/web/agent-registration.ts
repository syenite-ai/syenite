const REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

const CHAIN_IDS: Record<string, number> = {
  AGENT_ID_BASE: 8453,
  AGENT_ID_ETH: 1,
  AGENT_ID_ARB: 42161,
  AGENT_ID_BNB: 56,
};

export function agentRegistrationJson() {
  const registrations: Array<{ agentId: number; agentRegistry: string }> = [];

  for (const [envVar, chainId] of Object.entries(CHAIN_IDS)) {
    const id = process.env[envVar] ?? (envVar === "AGENT_ID_BASE" ? process.env.AGENT_ID : undefined);
    if (id) {
      registrations.push({
        agentId: parseInt(id, 10),
        agentRegistry: `eip155:${chainId}:${REGISTRY}`,
      });
    }
  }

  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Syenite",
    description:
      "Composable DeFi intelligence for AI agents: swaps and bridges (30+ chains), yield and lending, prediction markets, carry and strategy search, alerts, wallet and gas, and tx.verify/tx.simulate/tx.guard for verification before signing. MCP endpoint for reading and writing to DeFi.",
    image: "https://syenite.ai/assets/icon-64.png",
    services: [
      {
        name: "MCP",
        endpoint: "https://syenite.ai/mcp",
        version: "2025-06-18",
      },
      {
        name: "web",
        endpoint: "https://syenite.ai",
      },
    ],
    x402Support: true,
    active: true,
    registrations,
    supportedTrust: ["reputation"],
  };
}
