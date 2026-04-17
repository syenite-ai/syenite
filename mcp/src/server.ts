import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleRatesQuery, ratesToolDescription } from "./tools/rates.js";
import { handleMarketOverview, marketToolDescription } from "./tools/market.js";
import { handlePositionMonitor, monitorToolDescription } from "./tools/monitor.js";
import { handleRiskAssess, riskToolDescription } from "./tools/risk.js";
import { handleYieldOpportunities, yieldToolDescription } from "./tools/yield.js";
import { handleYieldAssess, yieldAssessToolDescription } from "./tools/yield-assess.js";
import { handleSwapQuote, handleSwapStatus, swapQuoteDescription, swapStatusDescription } from "./tools/swap.js";
import { handleSwapMulti, swapMultiDescription } from "./tools/multi-swap.js";
import { handleWalletBalances, walletBalancesDescription } from "./tools/wallet.js";
import { handleGasEstimate, gasEstimateDescription } from "./tools/gas.js";
import { handlePredictionSignals, predictionSignalsDescription } from "./tools/prediction-signals.js";
import { handleFindStrategy, findStrategyDescription } from "./tools/find-strategy.js";
import {
  handlePredictionTrending,
  handlePredictionSearch,
  handlePredictionBook,
  predictionTrendingDescription,
  predictionSearchDescription,
  predictionBookDescription,
} from "./tools/prediction.js";
import { handleCarryScreener, carryScreenerDescription } from "./tools/carry.js";
import {
  handleAlertWatch,
  handleAlertCheck,
  handleAlertList,
  handleAlertRemove,
  alertWatchDescription,
  alertCheckDescription,
  alertListDescription,
  alertRemoveDescription,
} from "./tools/alerts.js";
import { handlePredictionMarket, predictionMarketDescription } from "./tools/prediction-market.js";
import { handlePredictionWatch, predictionWatchDescription } from "./tools/prediction-watch.js";
import { handlePredictionPosition, predictionPositionDescription } from "./tools/prediction-position.js";
import { handlePredictionQuote, predictionQuoteDescription } from "./tools/prediction-quote.js";
import { handlePredictionOrder, predictionOrderDescription } from "./tools/prediction-order.js";
import type { PredictionConditions } from "./data/alerts.js";
import { logToolCall } from "./logging/usage.js";
import { recordToolCall } from "./logging/metrics.js";
import { SyeniteError } from "./errors.js";
import {
  helpOutput,
  ratesOutput,
  marketOverviewOutput,
  positionMonitorOutput,
  riskAssessOutput,
  yieldOpportunitiesOutput,
  yieldAssessOutput,
  swapQuoteOutput,
  swapStatusOutput,
  swapMultiOutput,
  walletBalancesOutput,
  gasEstimateOutput,
  predictionSignalsOutput,
  findStrategyOutput,
  predictionTrendingOutput,
  predictionSearchOutput,
  predictionBookOutput,
  carryScreenerOutput,
  alertWatchOutput,
  alertCheckOutput,
  alertListOutput,
  alertRemoveOutput,
  predictionMarketOutput,
  predictionWatchOutput,
  predictionPositionOutput,
  predictionQuoteOutput,
  predictionOrderOutput,
} from "./schemas.js";

function withLogging(
  clientIp: string,
  toolName: string,
  handler: (params: Record<string, unknown>) => Promise<Record<string, unknown>>,
  redactParams?: (params: Record<string, unknown>) => Record<string, unknown>
) {
  return async (params: Record<string, unknown>) => {
    const start = Date.now();
    try {
      const result = await handler(params);
      const elapsed = Date.now() - start;
      recordToolCall(toolName, elapsed, true);
      await logToolCall({
        clientIp,
        toolName,
        toolParams: redactParams ? redactParams(params) : params,
        responseTimeMs: elapsed,
        success: true,
      });
      return {
        structuredContent: result,
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    } catch (e) {
      const elapsed = Date.now() - start;
      const code = e instanceof SyeniteError ? e.code : "internal_error";
      const msg = e instanceof Error ? e.message : "Unknown error";
      const retryable = e instanceof SyeniteError ? e.retryable : false;
      recordToolCall(toolName, elapsed, false);
      await logToolCall({
        clientIp,
        toolName,
        toolParams: redactParams ? redactParams(params) : params,
        responseTimeMs: elapsed,
        success: false,
        errorMessage: msg,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: { code, message: msg, retryable } }),
        }],
        isError: true,
      };
    }
  };
}

export function createMcpServer(clientIp: string): McpServer {
  const server = new McpServer(
    {
      name: "syenite",
      version: "0.5.1",
    },
    { capabilities: { tools: {} } }
  );

  // ── syenite.help ──────────────────────────────────────────────────

  const helpData = {
    service: "Syenite — The DeFi interface for AI agents",
    description:
      "Swap routing, bridge execution, yield intelligence, lending rates, risk assessment, and position monitoring — one MCP endpoint for reading and writing to DeFi across 30+ chains.",
    tools: [
      { name: "wallet.balances", use: "Check native and token balances across chains for any EVM address. Verify funds before transacting." },
      { name: "gas.estimate", use: "Current gas prices and operation costs across chains. Find the cheapest chain for any operation." },
      { name: "swap.quote", use: "Get an optimal swap or bridge quote with unsigned transaction calldata. Same-chain swaps and cross-chain bridges via aggregated routing (1inch, 0x, Paraswap, bridges). 30+ chains." },
      { name: "swap.multi", use: "Batch multiple swap/bridge quotes in parallel. Split funds across chains or compare routes." },
      { name: "swap.status", use: "Track execution status of a cross-chain bridge transaction." },
      { name: "yield.opportunities", use: "Find the best yield for any asset across lending, staking, vaults, savings, and basis capture." },
      { name: "yield.assess", use: "Deep risk assessment for a specific yield strategy — smart contract, oracle, governance, liquidity, and depeg risk." },
      { name: "lending.rates.query", use: "Compare borrow/supply rates across protocols for any collateral and borrow asset pair." },
      { name: "lending.market.overview", use: "Aggregate market view — TVL, utilization, rate ranges per protocol." },
      { name: "lending.position.monitor", use: "Check health factor, liquidation distance, and costs for any Ethereum address." },
      { name: "lending.risk.assess", use: "Risk assessment for a proposed lending position — liquidation price, safety margin, annual cost." },
      { name: "strategy.carry.screen", use: "Screen all markets for positive carry (supply APY > borrow APY). Ranks self-funding leveraged strategies." },
      { name: "find.strategy", use: "Composable strategy finder — scans yield, carry, leverage, prediction, and gas data to surface the best opportunities for a given asset." },
      { name: "prediction.trending", use: "Top prediction markets by volume — probabilities, liquidity, and spread." },
      { name: "prediction.search", use: "Search prediction markets by topic." },
      { name: "prediction.book", use: "Order book depth and spread for a specific outcome token." },
      { name: "prediction.signals", use: "Detect actionable signals — wide spreads, extreme probabilities, volume spikes, mispricing." },
      { name: "prediction.market", use: "Deep drill-down on a single market — odds history, liquidity depth, resolution criteria, one-sided flow." },
      { name: "prediction.watch", use: "Monitor a market for odds threshold, movement, liquidity drop, resolution, or volume spikes." },
      { name: "prediction.position", use: "List an agent's Polymarket positions across markets — size, PnL, time-to-resolve." },
      { name: "prediction.quote", use: "Size-aware buy/sell quote walking the CLOB book — fill price, slippage, available depth." },
      { name: "prediction.order", use: "Prepare a Polymarket CLOB order (EIP-712) for signing plus the USDC approval tx." },
      { name: "alerts.watch", use: "Register a position for continuous health factor monitoring." },
      { name: "alerts.check", use: "Poll for active alerts (lending health factor + prediction triggers)." },
      { name: "alerts.list", use: "List all active position and prediction market watches." },
      { name: "alerts.remove", use: "Remove a watch." },
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
    lendingProtocols: ["Aave v3 (Ethereum, Arbitrum, Base)", "Morpho Blue (Ethereum)", "Spark (Ethereum)"],
    access: {
      status: "Free — no API key required",
      rateLimit: "30 requests/minute",
      endpoint: "https://syenite.ai/mcp",
    },
    website: "https://syenite.ai",
  };

  server.registerTool("syenite.help", {
    description: `Get information about Syenite — the DeFi interface for AI agents. Swap/bridge routing, yield intelligence, lending data, risk assessment, and position monitoring.
Call this tool to learn what tools are available and how to use them.`,
    outputSchema: helpOutput,
  }, async () => ({
    structuredContent: helpData,
    content: [{ type: "text" as const, text: JSON.stringify(helpData) }],
  }));

  // ── lending.rates.query ───────────────────────────────────────────

  server.registerTool("lending.rates.query", {
    description: ratesToolDescription,
    inputSchema: {
      collateral: z
        .string()
        .default("all")
        .describe('Collateral asset or category: "wBTC", "tBTC", "cbBTC", "WETH", "wstETH", "rETH", "cbETH", "weETH", "BTC", "ETH", or "all"'),
      borrowAsset: z
        .string()
        .default("USDC")
        .describe('Asset to borrow: "USDC", "USDT", "DAI", "GHO"'),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "all"])
        .default("all")
        .describe("Chain to query. Defaults to all supported chains."),
    },
    outputSchema: ratesOutput,
  }, withLogging(clientIp, "lending.rates.query", (p) =>
    handleRatesQuery(p as { collateral?: string; borrowAsset?: string; chain?: string })
  ));

  // ── lending.market.overview ───────────────────────────────────────

  server.registerTool("lending.market.overview", {
    description: marketToolDescription,
    inputSchema: {
      collateral: z
        .string()
        .default("all")
        .describe('Filter by collateral asset, or "all"'),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "all"])
        .default("all")
        .describe("Chain to query. Defaults to all supported chains."),
    },
    outputSchema: marketOverviewOutput,
  }, withLogging(clientIp, "lending.market.overview", (p) =>
    handleMarketOverview(p as { collateral?: string; chain?: string })
  ));

  // ── lending.position.monitor ──────────────────────────────────────

  server.registerTool("lending.position.monitor", {
    description: monitorToolDescription,
    inputSchema: {
      address: z.string().describe("EVM address to check (works on all supported chains)"),
      protocol: z
        .enum(["aave-v3", "compound-v3", "morpho", "spark", "all"])
        .default("all")
        .describe("Protocol filter"),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "all"])
        .default("all")
        .describe("Chain to query. Defaults to all supported chains."),
    },
    outputSchema: positionMonitorOutput,
  }, withLogging(
    clientIp,
    "lending.position.monitor",
    (p) => handlePositionMonitor(p as { address: string; protocol?: string; chain?: string }),
    (p) => ({ address: "***", protocol: p.protocol, chain: p.chain })
  ));

  // ── lending.risk.assess ───────────────────────────────────────────

  server.registerTool("lending.risk.assess", {
    description: riskToolDescription,
    inputSchema: {
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
    outputSchema: riskAssessOutput,
  }, withLogging(clientIp, "lending.risk.assess", (p) =>
    handleRiskAssess(
      p as {
        collateral: string;
        collateralAmount: number;
        borrowAsset?: string;
        targetLTV: number;
        protocol?: string;
      }
    )
  ));

  // ── yield.opportunities ──────────────────────────────────────────

  server.registerTool("yield.opportunities", {
    description: yieldToolDescription,
    inputSchema: {
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
    outputSchema: yieldOpportunitiesOutput,
  }, withLogging(clientIp, "yield.opportunities", (p) =>
    handleYieldOpportunities(p as { asset?: string; category?: string; riskTolerance?: string })
  ));

  // ── yield.assess ────────────────────────────────────────────────

  server.registerTool("yield.assess", {
    description: yieldAssessToolDescription,
    inputSchema: {
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
    outputSchema: yieldAssessOutput,
  }, withLogging(clientIp, "yield.assess", (p) =>
    handleYieldAssess(p as { protocol: string; product?: string; amount?: number; asset?: string })
  ));

  // ── swap.quote ─────────────────────────────────────────────────────

  server.registerTool("swap.quote", {
    description: swapQuoteDescription,
    inputSchema: {
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
    outputSchema: swapQuoteOutput,
  }, withLogging(
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
  ));

  // ── swap.status ───────────────────────────────────────────────────

  server.registerTool("swap.status", {
    description: swapStatusDescription,
    inputSchema: {
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
    outputSchema: swapStatusOutput,
  }, withLogging(clientIp, "swap.status", (p) =>
    handleSwapStatus(p as { txHash: string; fromChain?: string; toChain?: string })
  ));

  // ── swap.multi ──────────────────────────────────────────────────────

  const swapRequestItem = z.object({
    fromToken: z.string().describe("Token to sell — symbol or address"),
    toToken: z.string().describe("Token to buy — symbol or address"),
    fromAmount: z.string().describe("Amount in smallest unit"),
    fromAddress: z.string().describe("Sender wallet address"),
    toAddress: z.string().optional().describe("Recipient address"),
    fromChain: z.string().default("ethereum").describe("Source chain"),
    toChain: z.string().optional().describe("Destination chain"),
    slippage: z.number().optional(),
    order: z.enum(["CHEAPEST", "FASTEST"]).optional(),
  });

  server.registerTool("swap.multi", {
    description: swapMultiDescription,
    inputSchema: {
      requests: z.array(swapRequestItem).min(1).max(10).describe("Array of swap/bridge requests to quote in parallel"),
    },
    outputSchema: swapMultiOutput,
  }, withLogging(
    clientIp,
    "swap.multi",
    (p) => handleSwapMulti(p as { requests: Array<{
      fromToken: string; toToken: string; fromAmount: string; fromAddress: string;
      toAddress?: string; fromChain?: string; toChain?: string; slippage?: number; order?: string;
    }> }),
    (p) => ({ requests: `[${(p.requests as unknown[])?.length ?? 0} items]` })
  ));

  // ── wallet.balances ────────────────────────────────────────────────

  server.registerTool("wallet.balances", {
    description: walletBalancesDescription,
    inputSchema: {
      address: z.string().describe("EVM address to check"),
      chains: z
        .array(z.enum(["ethereum", "arbitrum", "base", "bsc"]))
        .optional()
        .describe("Chains to query (defaults to all: ethereum, arbitrum, base, bsc)"),
    },
    outputSchema: walletBalancesOutput,
  }, withLogging(
    clientIp,
    "wallet.balances",
    (p) => handleWalletBalances(p as { address: string; chains?: string[] }),
    (p) => ({ address: "***", chains: p.chains })
  ));

  // ── gas.estimate ───────────────────────────────────────────────────

  server.registerTool("gas.estimate", {
    description: gasEstimateDescription,
    inputSchema: {
      chains: z
        .array(z.enum(["ethereum", "arbitrum", "base", "bsc"]))
        .optional()
        .describe("Chains to check (defaults to all)"),
      operations: z
        .array(z.string())
        .optional()
        .describe("Operation types to estimate: transfer, erc20_transfer, swap, bridge, erc20_approve, lending_supply, lending_borrow, contract_register"),
    },
    outputSchema: gasEstimateOutput,
  }, withLogging(clientIp, "gas.estimate", (p) =>
    handleGasEstimate(p as { chains?: string[]; operations?: string[] })
  ));

  // ── strategy.carry.screen ──────────────────────────────────────────

  server.registerTool("strategy.carry.screen", {
    description: carryScreenerDescription,
    inputSchema: {
      collateral: z
        .string()
        .default("all")
        .describe('Collateral filter: specific asset, "BTC", "ETH", or "all"'),
      borrowAsset: z
        .string()
        .default("USDC")
        .describe("Borrow asset"),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "all"])
        .default("all")
        .describe("Chain filter"),
      minCarry: z
        .number()
        .optional()
        .describe("Minimum net carry % to include (e.g. 0 for positive-only)"),
      positionSizeUSD: z
        .number()
        .default(100000)
        .describe("Position size in USD for annual return calculation"),
    },
    outputSchema: carryScreenerOutput,
  }, withLogging(clientIp, "strategy.carry.screen", (p) =>
    handleCarryScreener(p as {
      collateral?: string;
      borrowAsset?: string;
      chain?: string;
      minCarry?: number;
      positionSizeUSD?: number;
    })
  ));

  // ── prediction.trending ────────────────────────────────────────────

  server.registerTool("prediction.trending", {
    description: predictionTrendingDescription,
    inputSchema: {
      limit: z
        .number()
        .min(1)
        .max(25)
        .default(10)
        .describe("Number of trending markets to return (max 25)"),
    },
    outputSchema: predictionTrendingOutput,
  }, withLogging(clientIp, "prediction.trending", (p) =>
    handlePredictionTrending(p as { limit?: number })
  ));

  // ── prediction.search ──────────────────────────────────────────────

  server.registerTool("prediction.search", {
    description: predictionSearchDescription,
    inputSchema: {
      query: z
        .string()
        .describe("Search query (e.g. 'Bitcoin price', 'US election', 'Fed rate')"),
      limit: z
        .number()
        .min(1)
        .max(25)
        .default(10)
        .describe("Maximum results to return"),
    },
    outputSchema: predictionSearchOutput,
  }, withLogging(clientIp, "prediction.search", (p) =>
    handlePredictionSearch(p as { query: string; limit?: number })
  ));

  // ── prediction.book ────────────────────────────────────────────────

  server.registerTool("prediction.book", {
    description: predictionBookDescription,
    inputSchema: {
      tokenId: z
        .string()
        .describe("Polymarket outcome token ID (from prediction.trending or prediction.search results)"),
    },
    outputSchema: predictionBookOutput,
  }, withLogging(clientIp, "prediction.book", (p) =>
    handlePredictionBook(p as { tokenId: string })
  ));

  // ── prediction.signals ──────────────────────────────────────────────

  server.registerTool("prediction.signals", {
    description: predictionSignalsDescription,
    inputSchema: {
      minStrength: z
        .number()
        .min(0)
        .max(100)
        .default(0)
        .describe("Minimum signal strength (0-100) to include"),
      types: z
        .array(z.enum(["wide_spread", "extreme_probability", "high_volume", "deep_liquidity", "mispriced"]))
        .optional()
        .describe("Filter to specific signal types (defaults to all)"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(20)
        .describe("Maximum signals to return"),
    },
    outputSchema: predictionSignalsOutput,
  }, withLogging(clientIp, "prediction.signals", (p) =>
    handlePredictionSignals(p as { minStrength?: number; types?: string[]; limit?: number })
  ));

  // ── find.strategy ──────────────────────────────────────────────────

  server.registerTool("find.strategy", {
    description: findStrategyDescription,
    inputSchema: {
      asset: z
        .string()
        .describe('Asset you have or want to deploy: "ETH", "WETH", "wBTC", "USDC", "USDT", etc.'),
      amount: z
        .number()
        .default(10000)
        .describe("Amount in USD to deploy (for return calculations)"),
      riskTolerance: z
        .enum(["low", "medium", "high"])
        .default("high")
        .describe("Maximum risk level: low (yield only), medium (carry + arb), high (leverage + prediction)"),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "all"])
        .default("all")
        .describe("Chain preference"),
      includePrediction: z
        .boolean()
        .default(true)
        .describe("Include prediction market signals in strategy search"),
    },
    outputSchema: findStrategyOutput,
  }, withLogging(clientIp, "find.strategy", (p) =>
    handleFindStrategy(p as {
      asset: string;
      amount?: number;
      riskTolerance?: string;
      chain?: string;
      includePrediction?: boolean;
    })
  ));

  // ── alerts.watch ──────────────────────────────────────────────────

  server.registerTool("alerts.watch", {
    description: alertWatchDescription,
    inputSchema: {
      address: z.string().describe("EVM address to monitor"),
      protocol: z
        .enum(["aave-v3", "compound-v3", "morpho", "spark", "all"])
        .default("all")
        .describe("Protocol filter"),
      chain: z
        .enum(["ethereum", "arbitrum", "base", "all"])
        .default("all")
        .describe("Chain filter"),
      healthFactorThreshold: z
        .number()
        .min(1.0)
        .max(5.0)
        .default(1.5)
        .describe("Alert when health factor drops below this value (default 1.5)"),
    },
    outputSchema: alertWatchOutput,
  }, withLogging(
    clientIp,
    "alerts.watch",
    (p) => handleAlertWatch(p as { address: string; protocol?: string; chain?: string; healthFactorThreshold?: number }),
    (p) => ({ address: "***", protocol: p.protocol, chain: p.chain, healthFactorThreshold: p.healthFactorThreshold })
  ));

  // ── alerts.check ──────────────────────────────────────────────────

  server.registerTool("alerts.check", {
    description: alertCheckDescription,
    inputSchema: {
      watchId: z.string().optional().describe("Filter alerts for a specific watch ID"),
      acknowledge: z.boolean().default(false).describe("Mark returned alerts as acknowledged"),
    },
    outputSchema: alertCheckOutput,
  }, withLogging(clientIp, "alerts.check", (p) =>
    handleAlertCheck(p as { watchId?: string; acknowledge?: boolean })
  ));

  // ── alerts.list ───────────────────────────────────────────────────

  server.registerTool("alerts.list", {
    description: alertListDescription,
    outputSchema: alertListOutput,
  }, withLogging(clientIp, "alerts.list", () => handleAlertList()));

  // ── alerts.remove ─────────────────────────────────────────────────

  server.registerTool("alerts.remove", {
    description: alertRemoveDescription,
    inputSchema: {
      watchId: z.string().describe("ID of the watch to remove"),
    },
    outputSchema: alertRemoveOutput,
  }, withLogging(clientIp, "alerts.remove", (p) =>
    handleAlertRemove(p as { watchId: string })
  ));

  // ── prediction.market ─────────────────────────────────────────────

  server.registerTool("prediction.market", {
    description: predictionMarketDescription,
    inputSchema: {
      slug: z.string().optional().describe("Polymarket market slug"),
      conditionId: z.string().optional().describe("Polymarket condition ID (0x-prefixed)"),
      marketId: z.string().optional().describe("Polymarket market ID"),
    },
    outputSchema: predictionMarketOutput,
  }, withLogging(clientIp, "prediction.market", (p) =>
    handlePredictionMarket(p as { slug?: string; conditionId?: string; marketId?: string })
  ));

  // ── prediction.watch ──────────────────────────────────────────────

  const predictionConditionsInput = z.object({
    oddsThresholdPct: z.number().min(0).max(100).optional(),
    oddsMovePct: z.object({
      delta: z.number().positive(),
      windowMinutes: z.number().positive(),
    }).optional(),
    liquidityDropPct: z.number().min(0).max(100).optional(),
    resolutionApproachingHours: z.number().positive().optional(),
    volumeSpikeMultiple: z.number().gt(1).optional(),
  });

  server.registerTool("prediction.watch", {
    description: predictionWatchDescription,
    inputSchema: {
      slug: z.string().optional().describe("Polymarket market slug"),
      conditionId: z.string().optional().describe("Polymarket condition ID"),
      conditions: predictionConditionsInput.describe("At least one condition required"),
      webhookUrl: z.string().url().optional().describe("Optional HTTPS webhook for alert delivery"),
    },
    outputSchema: predictionWatchOutput,
  }, withLogging(clientIp, "prediction.watch", (p) =>
    handlePredictionWatch(p as {
      slug?: string;
      conditionId?: string;
      conditions: PredictionConditions;
      webhookUrl?: string;
    })
  ));

  // ── prediction.position ───────────────────────────────────────────

  server.registerTool("prediction.position", {
    description: predictionPositionDescription,
    inputSchema: {
      address: z.string().describe("Polygon EOA address holding Polymarket positions"),
    },
    outputSchema: predictionPositionOutput,
  }, withLogging(
    clientIp,
    "prediction.position",
    (p) => handlePredictionPosition(p as { address: string }),
    (p) => ({ address: "***" + String(p.address).slice(-4) })
  ));

  // ── prediction.quote ──────────────────────────────────────────────

  server.registerTool("prediction.quote", {
    description: predictionQuoteDescription,
    inputSchema: {
      tokenId: z.string().describe("Polymarket outcome token ID"),
      side: z.enum(["buy", "sell"]),
      outcome: z.enum(["YES", "NO"]).describe("Informational — used for display only"),
      size: z.number().positive().describe("Order size in shares"),
      orderType: z.enum(["market", "limit"]).default("market"),
      limitPrice: z.number().min(0).max(1).optional().describe("Required for limit orders (USDC per share)"),
    },
    outputSchema: predictionQuoteOutput,
  }, withLogging(clientIp, "prediction.quote", (p) =>
    handlePredictionQuote(p as {
      tokenId: string;
      side: "buy" | "sell";
      outcome: "YES" | "NO";
      size: number;
      orderType?: "market" | "limit";
      limitPrice?: number;
    })
  ));

  // ── prediction.order ──────────────────────────────────────────────

  server.registerTool("prediction.order", {
    description: predictionOrderDescription,
    inputSchema: {
      tokenId: z.string().describe("Polymarket outcome token ID"),
      side: z.enum(["buy", "sell"]),
      outcome: z.enum(["YES", "NO"]),
      size: z.number().positive().describe("Shares"),
      price: z.number().min(0).max(1).describe("Limit price in USDC per share (0-1)"),
      maker: z.string().describe("Polygon EOA that will sign the EIP-712 order"),
      expiration: z.number().optional().describe("Unix seconds (0 = GTC, default)"),
    },
    outputSchema: predictionOrderOutput,
  }, withLogging(
    clientIp,
    "prediction.order",
    (p) => handlePredictionOrder(p as {
      tokenId: string;
      side: "buy" | "sell";
      outcome: "YES" | "NO";
      size: number;
      price: number;
      maker: string;
      expiration?: number;
    }),
    (p) => ({ ...p, maker: "***" + String(p.maker).slice(-4) })
  ));

  return server;
}
