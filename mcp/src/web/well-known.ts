export function wellKnownMcp() {
  return {
    name: "syenite",
    version: "0.4.0",
    description:
      "The DeFi interface for AI agents — swap routing, bridge execution, yield intelligence, lending rates, risk assessment, and position monitoring across 30+ chains via MCP",
    transport: "streamable-http",
    endpoint: "/mcp",
    authentication: "none",
    tools: [
      "syenite.help",
      "swap.quote",
      "swap.status",
      "yield.opportunities",
      "yield.assess",
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
