export function wellKnownMcp() {
  return {
    name: "syenite-lending",
    version: "0.1.0",
    description:
      "DeFi lending intelligence for AI agents — cross-protocol BTC rates, position monitoring, and risk assessment",
    transport: "streamable-http",
    endpoint: "/mcp",
    authentication: {
      type: "bearer",
      header: "Authorization",
      description:
        "API key in Bearer token format. Request a free key at the landing page.",
    },
    tools: [
      "lending.rates.query",
      "lending.market.overview",
      "lending.position.monitor",
      "lending.risk.assess",
    ],
    rateLimit: {
      requestsPerMinute: 100,
    },
  };
}
