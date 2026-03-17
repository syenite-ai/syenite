import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleRatesQuery, ratesToolDescription } from "./tools/rates.js";
import { handleMarketOverview, marketToolDescription } from "./tools/market.js";
import { handlePositionMonitor, monitorToolDescription } from "./tools/monitor.js";
import { handleRiskAssess, riskToolDescription } from "./tools/risk.js";
import { logToolCall } from "./logging/usage.js";

function withLogging(
  clientIp: string,
  toolName: string,
  handler: (params: Record<string, unknown>) => Promise<string>,
  redactParams?: (params: Record<string, unknown>) => Record<string, unknown>
) {
  return async (params: Record<string, unknown>) => {
    const start = Date.now();
    try {
      const result = await handler(params);
      logToolCall({
        clientIp,
        toolName,
        toolParams: redactParams ? redactParams(params) : params,
        responseTimeMs: Date.now() - start,
        success: true,
      });
      return { content: [{ type: "text" as const, text: result }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      logToolCall({
        clientIp,
        toolName,
        toolParams: redactParams ? redactParams(params) : params,
        responseTimeMs: Date.now() - start,
        success: false,
        errorMessage: msg,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }],
        isError: true,
      };
    }
  };
}

export function createMcpServer(clientIp: string): McpServer {
  const server = new McpServer(
    {
      name: "syenite-lending",
      version: "0.2.0",
    },
    { capabilities: { tools: {} } }
  );

  // ── syenite.help ──────────────────────────────────────────────────
  server.tool(
    "syenite.help",
    `Get information about Syenite's DeFi lending intelligence tools, supported protocols, assets, and how to get started.
Call this tool to learn what data is available and how to use it effectively.`,
    {},
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            service: "Syenite — DeFi Lending Intelligence",
            description:
              "Real-time lending market data across major DeFi protocols on Ethereum. Rates, positions, risk assessment, and market overviews — all from on-chain data.",
            tools: [
              {
                name: "lending.rates.query",
                use: "Compare borrow/supply rates across protocols for any collateral and borrow asset pair",
              },
              {
                name: "lending.market.overview",
                use: "Aggregate market view — TVL, utilization, rate ranges per protocol",
              },
              {
                name: "lending.position.monitor",
                use: "Check health factor, liquidation distance, and costs for any Ethereum address",
              },
              {
                name: "lending.risk.assess",
                use: "Risk assessment for a proposed position — liquidation price, safety margin, annual cost",
              },
            ],
            protocols: [
              "Aave v3",
              "Morpho Blue",
            ],
            assets: {
              collateral: ["wBTC", "tBTC", "cbBTC", "ETH", "WETH", "wstETH", "rETH", "cbETH"],
              borrow: ["USDC", "USDT", "DAI", "GHO"],
            },
            access: {
              status: "Free — no API key required",
              rateLimit: "30 requests/minute",
              endpoint: "https://syenite.ai/mcp",
            },
            website: "https://syenite.ai",
            signUp:
              "Visit https://syenite.ai to sign up for alerts, managed lending positions, and premium features.",
          }),
        },
      ],
    })
  );

  // ── lending.rates.query ───────────────────────────────────────────
  server.tool(
    "lending.rates.query",
    ratesToolDescription,
    {
      collateral: z
        .string()
        .default("all")
        .describe('Asset to use as collateral: "wBTC", "tBTC", "cbBTC", "ETH", "wstETH", "rETH", "cbETH", or "all"'),
      borrowAsset: z
        .string()
        .default("USDC")
        .describe('Asset to borrow: "USDC", "USDT", "DAI", "GHO"'),
    },
    withLogging(clientIp, "lending.rates.query", (p) =>
      handleRatesQuery(p as { collateral?: string; borrowAsset?: string })
    )
  );

  // ── lending.market.overview ───────────────────────────────────────
  server.tool(
    "lending.market.overview",
    marketToolDescription,
    {
      collateral: z
        .string()
        .default("all")
        .describe('Filter by collateral asset, or "all"'),
    },
    withLogging(clientIp, "lending.market.overview", (p) =>
      handleMarketOverview(p as { collateral?: string })
    )
  );

  // ── lending.position.monitor ──────────────────────────────────────
  server.tool(
    "lending.position.monitor",
    monitorToolDescription,
    {
      address: z.string().describe("Ethereum address to check"),
      protocol: z
        .enum(["aave-v3", "morpho", "all"])
        .default("all")
        .describe("Protocol filter"),
    },
    withLogging(
      clientIp,
      "lending.position.monitor",
      (p) => handlePositionMonitor(p as { address: string; protocol?: string }),
      (p) => ({ address: "***", protocol: p.protocol })
    )
  );

  // ── lending.risk.assess ───────────────────────────────────────────
  server.tool(
    "lending.risk.assess",
    riskToolDescription,
    {
      collateral: z
        .string()
        .describe('Collateral asset: "wBTC", "tBTC", "cbBTC", "ETH", "wstETH", "rETH", "cbETH"'),
      collateralAmount: z
        .number()
        .positive()
        .describe("Amount of collateral"),
      borrowAsset: z
        .string()
        .default("USDC")
        .describe("Asset to borrow"),
      targetLTV: z
        .number()
        .min(1)
        .max(99)
        .describe("Desired LTV percentage (1-99)"),
      protocol: z
        .enum(["aave-v3", "morpho", "best"])
        .default("best")
        .describe("Protocol preference"),
    },
    withLogging(clientIp, "lending.risk.assess", (p) =>
      handleRiskAssess(
        p as {
          collateral: string;
          collateralAmount: number;
          borrowAsset?: string;
          targetLTV: number;
          protocol?: string;
        }
      )
    )
  );

  return server;
}
