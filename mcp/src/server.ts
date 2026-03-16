import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleRatesQuery, ratesToolDescription } from "./tools/rates.js";
import { handleMarketOverview, marketToolDescription } from "./tools/market.js";
import { handlePositionMonitor, monitorToolDescription } from "./tools/monitor.js";
import { handleRiskAssess, riskToolDescription } from "./tools/risk.js";
import { logToolCall } from "./logging/usage.js";

export function createMcpServer(apiKey?: string | null): McpServer {
  const server = new McpServer(
    {
      name: "syenite-lending",
      version: "0.1.0",
    },
    { capabilities: { tools: {} } }
  );

  // ── lending.rates.query ─────────────────────────────────────────
  server.tool(
    "lending.rates.query",
    ratesToolDescription,
    {
      collateral: z
        .enum(["wBTC", "tBTC", "cbBTC", "all"])
        .default("all")
        .describe('BTC wrapper to query, or "all"'),
      borrowAsset: z
        .enum(["USDC", "USDT", "DAI"])
        .default("USDC")
        .describe("Stablecoin to borrow"),
    },
    async (params) => {
      const start = Date.now();
      try {
        const result = await handleRatesQuery(params);
        logToolCall({
          apiKey: apiKey ?? null,
          toolName: "lending.rates.query",
          toolParams: params,
          responseTimeMs: Date.now() - start,
          success: true,
        });
        return { content: [{ type: "text", text: result }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        logToolCall({
          apiKey: apiKey ?? null,
          toolName: "lending.rates.query",
          toolParams: params,
          responseTimeMs: Date.now() - start,
          success: false,
          errorMessage: msg,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: msg }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ── lending.market.overview ─────────────────────────────────────
  server.tool(
    "lending.market.overview",
    marketToolDescription,
    {
      collateral: z
        .enum(["wBTC", "tBTC", "cbBTC", "all"])
        .default("all")
        .describe("Filter by BTC wrapper"),
    },
    async (params) => {
      const start = Date.now();
      try {
        const result = await handleMarketOverview(params);
        logToolCall({
          apiKey: apiKey ?? null,
          toolName: "lending.market.overview",
          toolParams: params,
          responseTimeMs: Date.now() - start,
          success: true,
        });
        return { content: [{ type: "text", text: result }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        logToolCall({
          apiKey: apiKey ?? null,
          toolName: "lending.market.overview",
          toolParams: params,
          responseTimeMs: Date.now() - start,
          success: false,
          errorMessage: msg,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
          isError: true,
        };
      }
    }
  );

  // ── lending.position.monitor ────────────────────────────────────
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
    async (params) => {
      const start = Date.now();
      try {
        const result = await handlePositionMonitor(params);
        logToolCall({
          apiKey: apiKey ?? null,
          toolName: "lending.position.monitor",
          toolParams: { address: "***", protocol: params.protocol },
          responseTimeMs: Date.now() - start,
          success: true,
        });
        return { content: [{ type: "text", text: result }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        logToolCall({
          apiKey: apiKey ?? null,
          toolName: "lending.position.monitor",
          toolParams: { address: "***", protocol: params.protocol },
          responseTimeMs: Date.now() - start,
          success: false,
          errorMessage: msg,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
          isError: true,
        };
      }
    }
  );

  // ── lending.risk.assess ─────────────────────────────────────────
  server.tool(
    "lending.risk.assess",
    riskToolDescription,
    {
      collateral: z
        .enum(["wBTC", "tBTC", "cbBTC"])
        .describe("BTC wrapper for collateral"),
      collateralAmount: z
        .number()
        .positive()
        .describe("Amount of BTC collateral"),
      borrowAsset: z
        .enum(["USDC", "USDT", "DAI"])
        .default("USDC")
        .describe("Stablecoin to borrow"),
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
    async (params) => {
      const start = Date.now();
      try {
        const result = await handleRiskAssess(params);
        logToolCall({
          apiKey: apiKey ?? null,
          toolName: "lending.risk.assess",
          toolParams: params,
          responseTimeMs: Date.now() - start,
          success: true,
        });
        return { content: [{ type: "text", text: result }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        logToolCall({
          apiKey: apiKey ?? null,
          toolName: "lending.risk.assess",
          toolParams: params,
          responseTimeMs: Date.now() - start,
          success: false,
          errorMessage: msg,
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
          isError: true,
        };
      }
    }
  );

  return server;
}
