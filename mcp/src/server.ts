import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleRatesQuery, ratesToolDescription } from "./tools/rates.js";
import { handleMarketOverview, marketToolDescription } from "./tools/market.js";
import { handlePositionMonitor, monitorToolDescription } from "./tools/monitor.js";
import { handleRiskAssess, riskToolDescription } from "./tools/risk.js";
import { handleYieldOpportunities, yieldToolDescription } from "./tools/yield.js";
import { handleYieldAssess, yieldAssessToolDescription } from "./tools/yield-assess.js";
import { handleSwapQuote, handleSwapStatus, swapQuoteDescription, swapStatusDescription } from "./tools/swap.js";
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
      version: "0.4.0",
    },
    { capabilities: { tools: {} } }
  );

  // ── syenite.help ──────────────────────────────────────────────────
  server.tool(
    "syenite.help",
    `Get information about Syenite — the DeFi interface for AI agents. Swap/bridge routing, yield intelligence, lending data, risk assessment, and position monitoring.
Call this tool to learn what tools are available and how to use them.`,
    {},
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            service: "Syenite — The DeFi interface for AI agents",
            description:
              "Swap routing, bridge execution, yield intelligence, lending rates, risk assessment, and position monitoring — one MCP endpoint for reading and writing to DeFi across 30+ chains.",
            tools: [
              {
                name: "swap.quote",
                use: "Get an optimal swap or bridge quote with unsigned transaction calldata. Same-chain swaps and cross-chain bridges via aggregated routing (1inch, 0x, Paraswap, bridges). 30+ chains.",
              },
              {
                name: "swap.status",
                use: "Track execution status of a cross-chain bridge transaction.",
              },
              {
                name: "yield.opportunities",
                use: "Find the best yield for any asset across lending, staking, vaults, savings, and basis capture.",
              },
              {
                name: "yield.assess",
                use: "Deep risk assessment for a specific yield strategy — smart contract, oracle, governance, liquidity, and depeg risk.",
              },
              {
                name: "lending.rates.query",
                use: "Compare borrow/supply rates across protocols for any collateral and borrow asset pair.",
              },
              {
                name: "lending.market.overview",
                use: "Aggregate market view — TVL, utilization, rate ranges per protocol.",
              },
              {
                name: "lending.position.monitor",
                use: "Check health factor, liquidation distance, and costs for any Ethereum address.",
              },
              {
                name: "lending.risk.assess",
                use: "Risk assessment for a proposed lending position — liquidation price, safety margin, annual cost.",
              },
            ],
            swapAndBridge: {
              chains: "Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche, and 25+ more",
              routing: "Aggregated via 1inch, 0x, Paraswap, and bridge protocols",
              execution: "Returns unsigned transaction calldata — agent or user signs. Syenite never holds keys.",
            },
            yieldSources: {
              "lending-supply": ["Aave v3", "Morpho Blue", "Spark"],
              "liquid-staking": ["Lido (stETH/wstETH)", "Rocket Pool (rETH)", "Coinbase (cbETH)"],
              "savings-rate": ["Maker DSR (sDAI)"],
              vault: ["MetaMorpho (Steakhouse, Gauntlet)", "Yearn v3"],
              "basis-capture": ["Ethena (sUSDe)"],
            },
            lendingProtocols: ["Aave v3", "Morpho Blue", "Spark"],
            access: {
              status: "Free — no API key required",
              rateLimit: "30 requests/minute",
              endpoint: "https://syenite.ai/mcp",
            },
            website: "https://syenite.ai",
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

  // ── swap.quote ─────────────────────────────────────────────────────
  server.tool(
    "swap.quote",
    swapQuoteDescription,
    {
      fromToken: z
        .string()
        .describe('Token to sell — symbol (e.g. "USDC", "ETH") or contract address'),
      toToken: z
        .string()
        .describe('Token to buy — symbol (e.g. "WETH", "USDT") or contract address'),
      fromAmount: z
        .string()
        .describe("Amount to swap in smallest unit (e.g. 1000000 for 1 USDC with 6 decimals). Use token decimals."),
      fromAddress: z
        .string()
        .describe("Sender wallet address (used for routing and approval checks)"),
      toAddress: z
        .string()
        .optional()
        .describe("Recipient address (defaults to fromAddress)"),
      fromChain: z
        .string()
        .default("ethereum")
        .describe('Source chain: "ethereum", "arbitrum", "optimism", "base", "polygon", "bsc", "avalanche", or chain ID'),
      toChain: z
        .string()
        .optional()
        .describe("Destination chain (defaults to fromChain). Set differently for cross-chain bridges."),
      slippage: z
        .number()
        .min(0.001)
        .max(0.5)
        .default(0.005)
        .describe("Max slippage as decimal (0.005 = 0.5%)"),
      order: z
        .enum(["CHEAPEST", "FASTEST"])
        .default("CHEAPEST")
        .describe("Route preference: CHEAPEST (best price) or FASTEST (lowest execution time)"),
    },
    withLogging(
      clientIp,
      "swap.quote",
      (p) =>
        handleSwapQuote(
          p as {
            fromToken: string;
            toToken: string;
            fromAmount: string;
            fromAddress: string;
            toAddress?: string;
            fromChain?: string;
            toChain?: string;
            slippage?: number;
            order?: string;
          }
        ),
      (p) => ({ ...p, fromAddress: "***", toAddress: p.toAddress ? "***" : undefined })
    )
  );

  // ── swap.status ───────────────────────────────────────────────────
  server.tool(
    "swap.status",
    swapStatusDescription,
    {
      txHash: z
        .string()
        .describe("Transaction hash of the submitted swap/bridge"),
      fromChain: z
        .string()
        .default("ethereum")
        .describe("Chain where the transaction was submitted"),
      toChain: z
        .string()
        .optional()
        .describe("Destination chain (for cross-chain bridges)"),
    },
    withLogging(clientIp, "swap.status", (p) =>
      handleSwapStatus(p as { txHash: string; fromChain?: string; toChain?: string })
    )
  );

  return server;
}
