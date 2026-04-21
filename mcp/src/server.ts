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
import { handleTxSimulate, txSimulateDescription } from "./tools/tx-simulate.js";
import { handleTxVerify, txVerifyDescription } from "./tools/tx-verify.js";
import { handleTxGuard, txGuardDescription } from "./tools/tx-guard.js";
import { handlePredictionSignals, predictionSignalsDescription } from "./tools/prediction-signals.js";
import { handleFindStrategy, findStrategyDescription } from "./tools/find-strategy.js";
import {
  handleLendingSupply,
  handleLendingBorrow,
  handleLendingWithdraw,
  handleLendingRepay,
  lendingSupplyDescription,
  lendingBorrowDescription,
  lendingWithdrawDescription,
  lendingRepayDescription,
} from "./tools/lending-execute.js";
import { handleTxReceipt, txReceiptDescription } from "./tools/tx-receipt.js";
import { handleTokenPrice, tokenPriceDescription } from "./tools/token-price.js";
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
  handleMetaMorphoSupply,
  handleMetaMorphoWithdraw,
  metaMorphoSupplyDescription,
  metaMorphoWithdrawDescription,
} from "./tools/metamorpho-execute.js";
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
  txSimulateOutput,
  txVerifyOutput,
  txGuardOutput,
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
  lendingSupplyOutput,
  lendingBorrowOutput,
  lendingWithdrawOutput,
  lendingRepayOutput,
  txReceiptOutput,
  tokenPriceOutput,
  metaMorphoSupplyOutput,
  metaMorphoWithdrawOutput,
  predictionMarketOutput,
  predictionWatchOutput,
  predictionPositionOutput,
  predictionQuoteOutput,
  predictionOrderOutput,
} from "./schemas.js";

function extractChain(params: Record<string, unknown>): string | undefined {
  for (const key of ["chain", "fromChain", "toChain"]) {
    const v = params[key];
    if (typeof v === "string" && v.length > 0 && v !== "all") return v.toLowerCase();
  }
  // yield.opportunities uses chains[] array
  const chains = params.chains;
  if (Array.isArray(chains) && chains.length > 0 && typeof chains[0] === "string") {
    const first = chains[0].toLowerCase();
    if (first !== "all") return first;
  }
  return undefined;
}

function extractProtocol(params: Record<string, unknown>): string | undefined {
  const v = params.protocol;
  if (typeof v === "string" && v.length > 0 && v !== "all") return v.toLowerCase();
  return undefined;
}

function extractAsset(params: Record<string, unknown>): string | undefined {
  for (const key of ["asset", "collateral", "borrowAsset", "tokenSymbol"]) {
    const v = params[key];
    if (typeof v === "string" && v.length > 0 && v !== "all") return v.toUpperCase();
  }
  return undefined;
}

function withLogging(
  clientIp: string,
  toolName: string,
  handler: (params: Record<string, unknown>) => Promise<Record<string, unknown>>,
  redactParams?: (params: Record<string, unknown>) => Record<string, unknown>
) {
  return async (params: Record<string, unknown>) => {
    const start = Date.now();
    const chain = extractChain(params);
    const protocol = extractProtocol(params);
    const asset = extractAsset(params);
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
        chain,
        protocol,
        asset,
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
        chain,
        protocol,
        asset,
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
      version: "0.6.0",
    },
    { capabilities: { tools: {}, prompts: {} } }
  );

  // ── syenite.help ──────────────────────────────────────────────────

  const helpData = {
    service: "Syenite — The DeFi interface for AI agents",
    version: "0.6.0",
    description:
      "Real-time lending rates (Aave, Morpho, Compound, Spark) and yield opportunities across EVM and Solana — with position alerts and webhooks. Swap and bridge routing (30+ chains), lending execution (supply, borrow, withdraw, repay), MetaMorpho vaults, Pendle PT/YT, prediction markets (drill-down, CLOB orders, monitoring), carry and strategy search, wallet and gas, and a trust layer (tx.verify, tx.simulate, tx.guard) — one MCP endpoint for reading and writing to DeFi.",
    tools: [
      { name: "lending.rates.query", use: "Compare borrow/supply rates across protocols for any collateral and borrow asset pair." },
      { name: "yield.opportunities", use: "Find the best yield for any asset across lending, staking, vaults, savings, and basis capture." },
      { name: "yield.assess", use: "Deep risk assessment for a specific yield strategy — smart contract, oracle, governance, liquidity, and depeg risk." },
      { name: "lending.market.overview", use: "Aggregate market view — TVL, utilization, rate ranges per protocol." },
      { name: "lending.position.monitor", use: "Check health factor, liquidation distance, and costs for any Ethereum address." },
      { name: "lending.risk.assess", use: "Risk assessment for a proposed lending position — liquidation price, safety margin, annual cost." },
      { name: "alerts.watch", use: "Register a position for continuous health factor monitoring." },
      { name: "alerts.check", use: "Poll for active alerts (lending health factor + prediction triggers)." },
      { name: "alerts.list", use: "List all active position and prediction market watches." },
      { name: "alerts.remove", use: "Remove a watch." },
      { name: "lending.supply", use: "Generate unsigned supply (deposit) calldata for Aave v3 or Spark. Sign and submit to deposit collateral. For MetaMorpho vaults use metamorpho.supply." },
      { name: "lending.borrow", use: "Generate unsigned borrow calldata. Variable rate only (stable deprecated). Check lending.risk.assess first." },
      { name: "lending.withdraw", use: "Generate unsigned withdraw calldata for Aave v3 or Spark. Use 'max' to withdraw all. For MetaMorpho vaults use metamorpho.withdraw." },
      { name: "lending.repay", use: "Generate unsigned repay calldata. Use 'max' to repay all outstanding debt." },
      { name: "metamorpho.supply", use: "Generate unsigned ERC-4626 deposit calldata for a MetaMorpho vault (Steakhouse, Gauntlet, etc). Returns transactionRequest plus ERC-20 approval." },
      { name: "metamorpho.withdraw", use: "Generate unsigned ERC-4626 redeem calldata to withdraw from a MetaMorpho vault." },
      { name: "swap.quote", use: "Get an optimal swap or bridge quote with unsigned transaction calldata. Same-chain swaps and cross-chain bridges via aggregated routing (1inch, 0x, Paraswap, bridges). 30+ chains." },
      { name: "swap.multi", use: "Batch multiple swap/bridge quotes in parallel. Split funds across chains or compare routes." },
      { name: "swap.status", use: "Track execution status of a cross-chain bridge transaction." },
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
      { name: "tx.simulate", use: "Simulate a transaction before signing — balance changes, gas, revert detection. Third-party verified via EVM." },
      { name: "tx.verify", use: "Verify a contract via Etherscan + Sourcify. Check if it's a known protocol. Risk flags." },
      { name: "tx.guard", use: "Check a transaction against your own risk rules — value caps, allowlists, gas limits." },
      { name: "tx.receipt", use: "Fetch and decode a transaction receipt — success/failure, gas cost, events, token transfers. Close the execution loop." },
      { name: "token.price", use: "Current USD price for any token via Chainlink on-chain oracles — same feeds used by Aave, Morpho, and Spark for liquidation. Batch up to 20 symbols." },
      { name: "wallet.balances", use: "Check native and token balances across chains for any EVM address. Verify funds before transacting." },
      { name: "gas.estimate", use: "Current gas prices and operation costs across chains. Find the cheapest chain for any operation." },
    ],
    swapAndBridge: {
      chains: "Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche, and 25+ more",
      routing: "Aggregated via 1inch, 0x, Paraswap, and bridge protocols",
      execution: "Returns unsigned transaction calldata — agent or user signs. Syenite never holds keys.",
    },
    yieldSources: {
      "lending-supply": ["Aave v3", "Morpho Blue (Ethereum, Base, Arbitrum, Optimism)", "Spark"],
      "liquid-staking": ["Lido (stETH/wstETH)", "Rocket Pool (rETH)", "Coinbase (cbETH)", "Jito (jitoSOL)", "Marinade (mSOL)", "Sanctum LSTs"],
      "savings-rate": ["Maker DSR (sDAI)"],
      vault: ["MetaMorpho (Steakhouse, Gauntlet) — supply/withdraw via metamorpho.supply/withdraw", "Yearn v3"],
      "basis-capture": ["Ethena (sUSDe)"],
      "fixed-yield": ["Pendle PT markets (Ethereum, Arbitrum, Base)"],
      "solana": ["Kamino (lending + vaults)", "MarginFi (lending)", "Drift (perps + lending)", "Jupiter (DEX/aggregator)", "Jito (staking)", "Marinade (staking)", "Sanctum (LST router)"],
    },
    lendingProtocols: ["Aave v3 (Ethereum, Arbitrum, Base)", "Morpho Blue (Ethereum, Base, Arbitrum, Optimism)", "Spark (Ethereum)", "Compound v3 (Ethereum, Arbitrum, Base)", "Kamino (Solana)", "MarginFi (Solana)"],
    access: {
      status: "Free — no API key required",
      rateLimit: "30 requests/minute",
      endpoint: "https://syenite.ai/mcp",
    },
    website: "https://syenite.ai",
  };

  server.registerTool("syenite.help", {
    description: `Get information about Syenite — real-time lending rates, yield, and position alerts for AI agents. Covers Aave, Morpho, Compound, Spark, and Pendle. Also: swap/bridge routing (30+ chains), lending execution, prediction markets, carry screening, and a trust layer for transaction verification.
Call this tool to learn what tools are available and how to use them.`,
    annotations: { title: "Syenite Help", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    outputSchema: helpOutput,
  }, async () => ({
    structuredContent: helpData,
    content: [{ type: "text" as const, text: JSON.stringify(helpData) }],
  }));

  // ── lending.rates.query ───────────────────────────────────────────

  server.registerTool("lending.rates.query", {
    description: ratesToolDescription,
    annotations: { title: "Lending Rates", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Market Overview", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Position Monitor", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Risk Assessment", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Yield Opportunities", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
      tags: z
        .array(z.string())
        .optional()
        .describe('Tag filters: ["fixed-yield"] isolates Pendle PT; ["yt","leveraged-variable"] surfaces Pendle YT (hidden by default)'),
    },
    outputSchema: yieldOpportunitiesOutput,
  }, withLogging(clientIp, "yield.opportunities", (p) =>
    handleYieldOpportunities(p as { asset?: string; category?: string; riskTolerance?: string; tags?: string[] })
  ));

  // ── yield.assess ────────────────────────────────────────────────

  server.registerTool("yield.assess", {
    description: yieldAssessToolDescription,
    annotations: { title: "Yield Risk Assessment", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Swap / Bridge Quote", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Swap Status", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Batch Swap Quotes", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Wallet Balances", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Gas Estimate", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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

  // ── tx.simulate ─────────────────────────────────────────────────────

  const txTransactionSchema = z.object({
    to: z.string().describe("Target contract address"),
    data: z.string().describe("Calldata (hex)"),
    value: z.string().optional().describe("Native token value (hex or decimal wei)"),
    from: z.string().describe("Sender address"),
    chainId: z.number().optional(),
  });

  server.registerTool("tx.simulate", {
    description: txSimulateDescription,
    annotations: { title: "Simulate Transaction", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      transaction: txTransactionSchema,
      chain: z.string().optional().describe("Chain name or ID (defaults to tx chainId or ethereum)"),
    },
    outputSchema: txSimulateOutput,
  }, withLogging(
    clientIp,
    "tx.simulate",
    (p) => handleTxSimulate(p as {
      transaction: { to: string; data: string; value?: string; from: string; chainId?: number };
      chain?: string;
    }),
    (p) => {
      const tx = p.transaction as Record<string, unknown>;
      return { transaction: { to: tx?.to, from: "***", data: `${String(tx?.data ?? "").slice(0, 10)}...` }, chain: p.chain };
    }
  ));

  // ── tx.verify ──────────────────────────────────────────────────────

  server.registerTool("tx.verify", {
    description: txVerifyDescription,
    annotations: { title: "Verify Contract", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      to: z.string().describe("Contract address to verify"),
      chain: z.string().describe("Chain name: ethereum, arbitrum, base, bsc"),
      data: z.string().optional().describe("Calldata — if provided, decodes the function being called"),
    },
    outputSchema: txVerifyOutput,
  }, withLogging(clientIp, "tx.verify", (p) =>
    handleTxVerify(p as { to: string; chain: string; data?: string })
  ));

  // ── tx.guard ───────────────────────────────────────────────────────

  const guardRulesSchema = z.object({
    maxValueNative: z.string().optional().describe("Max native token value (e.g. '0.1' for 0.1 ETH)"),
    allowedContracts: z.array(z.string()).optional().describe("Allowlisted contract addresses"),
    blockedContracts: z.array(z.string()).optional().describe("Blocklisted contract addresses"),
    allowedFunctions: z.array(z.string()).optional().describe("Permitted function selectors or names"),
    requireVerifiedContract: z.boolean().optional().describe("Require Etherscan/Sourcify verified"),
    requireAllowlisted: z.boolean().optional().describe("Require contract in Syenite protocol registry"),
    maxGasLimit: z.number().optional().describe("Maximum gas limit"),
  });

  server.registerTool("tx.guard", {
    description: txGuardDescription,
    annotations: { title: "Transaction Guard", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      transaction: z.object({
        to: z.string().describe("Target address"),
        data: z.string().optional().describe("Calldata"),
        value: z.string().optional().describe("Native value (wei)"),
        gasLimit: z.string().optional(),
        chainId: z.number().optional(),
      }),
      rules: guardRulesSchema,
      chain: z.string().optional().describe("Chain name (defaults to ethereum)"),
    },
    outputSchema: txGuardOutput,
  }, withLogging(
    clientIp,
    "tx.guard",
    (p) => handleTxGuard(p as {
      transaction: { to: string; data?: string; value?: string; gasLimit?: string; chainId?: number };
      rules: Record<string, unknown>;
      chain?: string;
    }),
    (p) => ({ transaction: { to: (p.transaction as Record<string, unknown>)?.to }, rules: "[redacted]", chain: p.chain })
  ));

  // ── strategy.carry.screen ──────────────────────────────────────────

  server.registerTool("strategy.carry.screen", {
    description: carryScreenerDescription,
    annotations: { title: "Carry Screener", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Trending Markets", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Search Prediction Markets", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Order Book", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Prediction Signals", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Find Strategy", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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

  // ── lending.supply ──────────────────────────────────────────────────

  server.registerTool("lending.supply", {
    description: lendingSupplyDescription,
    annotations: { title: "Supply Collateral", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      protocol: z.enum(["aave-v3", "spark"]).default("aave-v3").describe("Lending protocol"),
      chain: z.enum(["ethereum", "arbitrum", "base"]).default("ethereum").describe("Chain where the pool lives"),
      asset: z.string().describe('Token to supply: "USDC", "WETH", "wBTC", "tBTC", "DAI", etc.'),
      amount: z.string().describe("Amount in human-readable units (e.g. '1000' for 1000 USDC)"),
      onBehalfOf: z.string().describe("Address that will receive the aToken (usually your own address)"),
    },
    outputSchema: lendingSupplyOutput,
  }, withLogging(
    clientIp,
    "lending.supply",
    (p) => handleLendingSupply(p as { protocol: string; chain: string; asset: string; amount: string; onBehalfOf: string }),
    (p) => ({ protocol: p.protocol, chain: p.chain, asset: p.asset, amount: p.amount, onBehalfOf: "***" })
  ));

  // ── lending.borrow ──────────────────────────────────────────────────

  server.registerTool("lending.borrow", {
    description: lendingBorrowDescription,
    annotations: { title: "Borrow Asset", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      protocol: z.enum(["aave-v3", "spark"]).default("aave-v3").describe("Lending protocol"),
      chain: z.enum(["ethereum", "arbitrum", "base"]).default("ethereum").describe("Chain"),
      asset: z.string().describe('Asset to borrow: "USDC", "USDT", "DAI", "GHO"'),
      amount: z.string().describe("Borrow amount in human-readable units"),
      onBehalfOf: z.string().describe("Address with collateral deposited"),
    },
    outputSchema: lendingBorrowOutput,
  }, withLogging(
    clientIp,
    "lending.borrow",
    (p) => handleLendingBorrow(p as { protocol: string; chain: string; asset: string; amount: string; onBehalfOf: string }),
    (p) => ({ protocol: p.protocol, chain: p.chain, asset: p.asset, amount: p.amount, onBehalfOf: "***" })
  ));

  // ── lending.withdraw ────────────────────────────────────────────────

  server.registerTool("lending.withdraw", {
    description: lendingWithdrawDescription,
    annotations: { title: "Withdraw Collateral", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      protocol: z.enum(["aave-v3", "spark"]).default("aave-v3").describe("Lending protocol"),
      chain: z.enum(["ethereum", "arbitrum", "base"]).default("ethereum").describe("Chain"),
      asset: z.string().describe("Asset to withdraw"),
      amount: z.string().describe('Amount in human-readable units, or "max" to withdraw all'),
      to: z.string().describe("Recipient address for withdrawn tokens"),
    },
    outputSchema: lendingWithdrawOutput,
  }, withLogging(
    clientIp,
    "lending.withdraw",
    (p) => handleLendingWithdraw(p as { protocol: string; chain: string; asset: string; amount: string; to: string }),
    (p) => ({ protocol: p.protocol, chain: p.chain, asset: p.asset, amount: p.amount, to: "***" })
  ));

  // ── lending.repay ──────────────────────────────────────────────────

  server.registerTool("lending.repay", {
    description: lendingRepayDescription,
    annotations: { title: "Repay Loan", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      protocol: z.enum(["aave-v3", "spark"]).default("aave-v3").describe("Lending protocol"),
      chain: z.enum(["ethereum", "arbitrum", "base"]).default("ethereum").describe("Chain"),
      asset: z.string().describe("Asset to repay"),
      amount: z.string().describe('Repay amount in human-readable units, or "max" for full repayment'),
      onBehalfOf: z.string().describe("Address whose debt to repay"),
    },
    outputSchema: lendingRepayOutput,
  }, withLogging(
    clientIp,
    "lending.repay",
    (p) => handleLendingRepay(p as { protocol: string; chain: string; asset: string; amount: string; onBehalfOf: string }),
    (p) => ({ protocol: p.protocol, chain: p.chain, asset: p.asset, amount: p.amount, onBehalfOf: "***" })
  ));

  // ── tx.receipt ─────────────────────────────────────────────────────

  server.registerTool("tx.receipt", {
    description: txReceiptDescription,
    annotations: { title: "Transaction Receipt", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      txHash: z.string().describe("Transaction hash to look up"),
      chain: z.string().default("ethereum").describe("Chain: ethereum, arbitrum, base, bsc (or chain ID)"),
    },
    outputSchema: txReceiptOutput,
  }, withLogging(clientIp, "tx.receipt", (p) =>
    handleTxReceipt(p as { txHash: string; chain?: string })
  ));

  // ── token.price ────────────────────────────────────────────────────

  server.registerTool("token.price", {
    description: tokenPriceDescription,
    annotations: { title: "Token Price", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      symbol: z.string().default("WETH").describe("Token symbol (e.g. wBTC, WETH, USDC). Ignored when symbols is provided."),
      symbols: z.array(z.string()).optional().describe("Batch: array of token symbols to price in one call (up to 20)"),
    },
    outputSchema: tokenPriceOutput,
  }, withLogging(clientIp, "token.price", (p) =>
    handleTokenPrice(p as { symbol: string; symbols?: string[] })
  ));

  // ── alerts.watch ──────────────────────────────────────────────────

  server.registerTool("alerts.watch", {
    description: alertWatchDescription,
    annotations: { title: "Watch Rates or Position", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: z
        .enum(["lending", "rate", "yield"])
        .default("lending")
        .describe("Watch type: lending (health factor), rate (borrow/supply APY threshold), yield (best APY threshold)"),
      webhookUrl: z.string().optional().describe("HTTP(S) URL to POST alerts to in real-time"),
      // lending params
      address: z.string().optional().describe("EVM address to monitor (required for lending watches)"),
      protocol: z
        .enum(["aave-v3", "compound-v3", "morpho", "spark", "all"])
        .optional()
        .describe("Protocol filter (lending watches)"),
      chain: z.enum(["ethereum", "arbitrum", "base", "all"]).optional().describe("Chain filter (lending watches)"),
      healthFactorThreshold: z
        .number().min(1.0).max(5.0).optional()
        .describe("Alert when health factor drops below this (default 1.5, lending watches only)"),
      // rate params
      rateCollateral: z.string().optional().describe("Collateral asset to monitor, e.g. wBTC (rate watches)"),
      rateBorrowAsset: z.string().optional().describe("Borrow asset, e.g. USDC (rate watches, default USDC)"),
      rateChain: z.string().optional().describe("Chain to monitor rates on (rate watches)"),
      rateProtocol: z
        .enum(["aave-v3", "morpho", "spark", "compound-v3", "fluid", "all"])
        .optional()
        .describe("Protocol to monitor (rate watches)"),
      rateBorrowThreshold: z.number().optional().describe("Borrow APY % threshold (rate watches)"),
      rateSupplyThreshold: z.number().optional().describe("Supply APY % threshold (rate watches)"),
      rateDirection: z
        .enum(["above", "below"])
        .optional()
        .describe("Fire when rate goes above or below threshold (default above, rate watches)"),
      // yield params
      yieldAsset: z.string().optional().describe("Asset to find yields for, e.g. ETH, USDC, stables (yield watches)"),
      yieldChains: z.array(z.string()).optional().describe("Chains to include, e.g. ['ethereum', 'solana'] (yield watches)"),
      yieldRisk: z.enum(["low", "medium", "high"]).optional().describe("Max risk level to include (yield watches)"),
      yieldApyThreshold: z.number().optional().describe("APY % threshold to fire alert at (yield watches)"),
      yieldDirection: z
        .enum(["above", "below"])
        .optional()
        .describe("Fire when best APY goes above or below threshold (default above, yield watches)"),
    },
    outputSchema: alertWatchOutput,
  }, withLogging(
    clientIp,
    "alerts.watch",
    (p) => handleAlertWatch(p as Parameters<typeof handleAlertWatch>[0]),
    (p) => ({ type: p.type, address: p.address ? "***" : undefined, rateCollateral: p.rateCollateral,
      rateBorrowAsset: p.rateBorrowAsset, yieldAsset: p.yieldAsset, webhookUrl: p.webhookUrl ? "[set]" : undefined })
  ));

  // ── alerts.check ──────────────────────────────────────────────────

  server.registerTool("alerts.check", {
    description: alertCheckDescription,
    annotations: { title: "Check Alerts", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
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
    annotations: { title: "List Watches", readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    outputSchema: alertListOutput,
  }, withLogging(clientIp, "alerts.list", () => handleAlertList()));

  // ── alerts.remove ─────────────────────────────────────────────────

  server.registerTool("alerts.remove", {
    description: alertRemoveDescription,
    annotations: { title: "Remove Watch", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      watchId: z.string().describe("ID of the watch to remove"),
    },
    outputSchema: alertRemoveOutput,
  }, withLogging(clientIp, "alerts.remove", (p) =>
    handleAlertRemove(p as { watchId: string })
  ));

  // ── metamorpho.supply (ERC-4626 deposit into curated vault) ────────

  server.registerTool("metamorpho.supply", {
    description: metaMorphoSupplyDescription,
    annotations: { title: "MetaMorpho Deposit", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      vault: z
        .string()
        .describe('Target MetaMorpho vault — address (0x...) or name fragment (e.g. "Steakhouse USDC")'),
      amount: z
        .string()
        .describe("Amount to deposit in human units (e.g. '1000' for 1000 USDC)"),
      receiver: z
        .string()
        .describe("Address that receives the vault shares"),
    },
    outputSchema: metaMorphoSupplyOutput,
  }, withLogging(
    clientIp,
    "metamorpho.supply",
    (p) => handleMetaMorphoSupply(p as { vault: string; amount: string; receiver: string }),
    (p) => ({ vault: p.vault, amount: p.amount, receiver: "***" })
  ));

  // ── metamorpho.withdraw (ERC-4626 redeem from curated vault) ───────

  server.registerTool("metamorpho.withdraw", {
    description: metaMorphoWithdrawDescription,
    annotations: { title: "MetaMorpho Withdraw", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    inputSchema: {
      vault: z
        .string()
        .describe('MetaMorpho vault — address or name fragment'),
      shares: z
        .string()
        .describe("Share amount in human units, or 'max' to redeem all"),
      receiver: z
        .string()
        .describe("Address that receives the withdrawn underlying"),
      owner: z
        .string()
        .describe("Owner of the shares (must have authorized the caller if different)"),
    },
    outputSchema: metaMorphoWithdrawOutput,
  }, withLogging(
    clientIp,
    "metamorpho.withdraw",
    (p) => handleMetaMorphoWithdraw(p as { vault: string; shares: string; receiver: string; owner: string }),
    (p) => ({ vault: p.vault, shares: p.shares, receiver: "***", owner: "***" })
  ));

  // ── prediction.market ─────────────────────────────────────────────

  server.registerTool("prediction.market", {
    description: predictionMarketDescription,
    annotations: { title: "Market Detail", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Watch Market", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Prediction Positions", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Prediction Quote", readOnlyHint: true, destructiveHint: false, openWorldHint: true },
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
    annotations: { title: "Place Prediction Order", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
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

  // ── Prompts ───────────────────────────────────────────────────────

  server.registerPrompt("find-yield", {
    description: "Find the best yield opportunities for a given asset across DeFi protocols",
    argsSchema: {
      asset: z.string().describe('Asset to find yield for (e.g. "ETH", "USDC", "wBTC")'),
    },
  }, async ({ asset }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Use yield.opportunities with asset="${asset}" to find the best current yield opportunities. Show APY, protocol, risk level, and any relevant details. Sort by APY descending and highlight any fixed-yield (Pendle PT) options.`,
      },
    }],
  }));

  server.registerPrompt("market-overview", {
    description: "Get current DeFi lending market rates, TVL, and utilization across protocols",
  }, async () => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: "Call lending.market.overview with chain='all' to show current DeFi lending market state. Then call lending.rates.query with collateral='all' and chain='all' to show current borrow and supply rates. Summarize the best supply and borrow opportunities.",
      },
    }],
  }));

  server.registerPrompt("check-position", {
    description: "Check health factor and liquidation risk for a lending position",
    argsSchema: {
      address: z.string().describe("EVM wallet address to check (0x...)"),
    },
  }, async ({ address }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Use lending.position.monitor with address="${address}" and protocol="all" and chain="all" to check the current health factor and liquidation risk. Flag any positions below health factor 1.5 and recommend corrective actions if needed.`,
      },
    }],
  }));

  return server;
}
