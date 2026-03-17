export function wellKnownMcp() {
  return {
    name: "syenite-lending",
    version: "0.2.0",
    description:
      "DeFi lending intelligence for AI agents — cross-protocol rates, position monitoring, and risk assessment across Aave v3, Morpho Blue, and more on Ethereum",
    transport: "streamable-http",
    endpoint: "/mcp",
    authentication: "none",
    tools: [
      "syenite.help",
      "lending.rates.query",
      "lending.market.overview",
      "lending.position.monitor",
      "lending.risk.assess",
    ],
    rateLimit: {
      requestsPerMinute: 30,
      basis: "IP address",
    },
  };
}
