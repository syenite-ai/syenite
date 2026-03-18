import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleRatesQuery, ratesToolDescription } from "./tools/rates.js";
import { handleMarketOverview, marketToolDescription } from "./tools/market.js";
import { handlePositionMonitor, monitorToolDescription } from "./tools/monitor.js";
import { handleRiskAssess, riskToolDescription } from "./tools/risk.js";
import { handleYieldOpportunities, yieldToolDescription } from "./tools/yield.js";
import { handleYieldAssess, yieldAssessToolDescription } from "./tools/yield-assess.js";
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
      name: "syenite",
      version: "0.3.1",
    },
    { capabilities: { tools: {} } }
  );

  // ── syenite.help ──────────────────────────────────────────────────
  server.tool(
    "syenite.help",
    `Get information about Syenite's DeFi intelligence tools, supported protocols, assets, yield sources, and how to get started.
Call this tool to learn what data is available and how to use it effectively.`,
    {},
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            service: "Syenite — DeFi Intelligence",
            description:
              "Yield, lending, and risk data for AI agents. Cross-protocol rates, yield opportunities, position monitoring, and risk assessment — all from on-chain data on Ethereum.",
            tools: [
              {
                name: "yield.opportunities",
                use: "Find the best yield for any asset across lending, staking, vaults, savings, basis capture, and fixed yield",
              },
              {
                name: "yield.assess",
                use: "Deep risk assessment for a specific yield strategy — smart contract, oracle, governance, liquidity, and depeg risk",
              },
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
                use: "Risk assessment for a proposed lending position — liquidation price, safety margin, annual cost",
              },
            ],
            yieldSources: {
              "lending-supply": ["Aave v3", "Morpho Blue", "Spark"],
              "liquid-staking": ["Lido (stETH/wstETH)", "Rocket Pool (rETH)", "Coinbase (cbETH)"],
              "savings-rate": ["Maker DSR (sDAI)"],
              vault: ["MetaMorpho (Steakhouse, Gauntlet)", "Yearn v3"],
              "basis-capture": ["Ethena (sUSDe)"],
            },
            lendingProtocols: ["Aave v3", "Morpho Blue", "Spark"],
            assets: {
              collateral: ["wBTC", "tBTC", "cbBTC", "WETH", "wstETH", "rETH", "cbETH", "weETH"],
              borrow: ["USDC", "USDT", "DAI", "GHO"],
            },
            access: {
              status: "Free — no API key required",
              rateLimit: "30 requests/minute",
              endpoint: "https://syenite.ai/mcp",
            },
            website: "https://syenite.ai",
            signUp:
              "Visit https://syenite.ai to sign up for alerts, managed positions, and premium features.",
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
        .describe('Collateral asset or category: "wBTC", "tBTC", "cbBTC", "WETH", "wstETH", "rETH", "cbETH", "weETH", "BTC", "ETH", or "all"'),
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
        .enum(["aave-v3", "morpho", "spark", "all"])
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
        .describe('Collateral asset: "wBTC", "tBTC", "cbBTC", "WETH", "wstETH", "rETH", "cbETH", "weETH"'),
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
        .enum(["aave-v3", "morpho", "spark", "best"])
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

  // ── yield.opportunities ──────────────────────────────────────────
  server.tool(
    "yield.opportunities",
    yieldToolDescription,
    {
      asset: z
        .string()
        .default("all")
        .describe('Asset to find yield for: "ETH", "USDC", "DAI", "WETH", "USDe", "stables", or "all"'),
      category: z
        .string()
        .default("all")
        .describe('Yield category filter: "lending-supply", "liquid-staking", "vault", "savings-rate", "basis-capture", or "all"'),
      riskTolerance: z
        .enum(["low", "medium", "high"])
        .default("high")
        .describe('Maximum risk level to show: "low", "medium", or "high" (default, shows all)'),
    },
    withLogging(clientIp, "yield.opportunities", (p) =>
      handleYieldOpportunities(p as { asset?: string; category?: string; riskTolerance?: string })
    )
  );

  // ── yield.assess ────────────────────────────────────────────────
  server.tool(
    "yield.assess",
    yieldAssessToolDescription,
    {
      protocol: z
        .string()
        .describe('Protocol to assess: "Aave", "Lido", "Morpho", "Ethena", "Yearn", "Maker", "Rocket Pool", "Coinbase"'),
      product: z
        .string()
        .optional()
        .describe("Specific product name (optional, helps match the right source)"),
      amount: z
        .number()
        .optional()
        .describe("Amount in USD to deposit (optional, enables position sizing analysis)"),
      asset: z
        .string()
        .default("all")
        .describe("Asset context for finding alternatives"),
    },
    withLogging(clientIp, "yield.assess", (p) =>
      handleYieldAssess(p as { protocol: string; product?: string; amount?: number; asset?: string })
    )
  );

  return server;
}
