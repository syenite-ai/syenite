export function wellKnownMcp() {
  return {
    name: "syenite",
    version: "0.3.1",
    description:
      "DeFi intelligence for AI agents — yield opportunities, lending rates, risk assessment, and position monitoring across blue-chip DeFi protocols on Ethereum",
    transport: "streamable-http",
    endpoint: "/mcp",
    authentication: "none",
    tools: [
      "syenite.help",
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
