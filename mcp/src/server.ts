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
  metaMorphoSupplyOutput,
  metaMorphoWithdrawOutput,
} from "./schemas.js";

function extractDimension(
  params: Record<string, unknown>,
  key: "chain" | "protocol"
): string | undefined {
  const direct = params[key];
  if (typeof direct === "string" && direct.length > 0 && direct !== "all") {
    return direct.toLowerCase();
  }
  if (key === "chain") {
    const fromChain = params.fromChain;
    if (typeof fromChain === "string" && fromChain.length > 0) {
      return fromChain.toLowerCase();
    }
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
    const chain = extractDimension(params, "chain");
    const protocol = extractDimension(params, "protocol");
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
      "Swap routing, bridge execution, yield and lending intelligence, prediction markets, carry and strategy search, position alerts, wallet and gas tools, and a trust layer (tx.verify, tx.simulate, tx.guard) — one MCP endpoint for reading and writing to DeFi across 30+ chains.",
    tools: [
      { name: "wallet.balances", use: "Check native and token balances across chains for any EVM address. Verify funds before transacting." },
      { name: "gas.estimate", use: "Current gas prices and operation costs across chains. Find the cheapest chain for any operation." },
      { name: "swap.quote", use: "Get an optimal swap or bridge quote with unsigned transaction calldata. Same-chain swaps and cross-chain bridges via aggregated routing (1inch, 0x, Paraswap, bridges). 30+ chains." },
      { name: "swap.multi", use: "Batch multiple swap/bridge quotes in parallel. Split funds across chains or compare routes." },
      { name: "swap.status", use: "Track execution status of a cross-chain bridge transaction." },
      { name: "tx.simulate", use: "Simulate a transaction before signing — balance changes, gas, revert detection. Third-party verified via EVM." },
      { name: "tx.verify", use: "Verify a contract via Etherscan + Sourcify. Check if it's a known protocol. Risk flags." },
      { name: "tx.guard", use: "Check a transaction against your own risk rules — value caps, allowlists, gas limits." },
      { name: "yield.opportunities", use: "Find the best yield for any asset across lending, staking, vaults, savings, and basis capture." },
      { name: "yield.assess", use: "Deep risk assessment for a specific yield strategy — smart contract, oracle, governance, liquidity, and depeg risk." },
      { name: "lending.rates.query", use: "Compare borrow/supply rates across protocols for any collateral and borrow asset pair." },
      { name: "lending.market.overview", use: "Aggregate market view — TVL, utilization, rate ranges per protocol." },
      { name: "lending.position.monitor", use: "Check health factor, liquidation distance, and costs for any Ethereum address." },
      { name: "lending.risk.assess", use: "Risk assessment for a proposed lending position — liquidation price, safety margin, annual cost." },
      { name: "lending.supply", use: "Generate unsigned supply (deposit) calldata for Aave v3 or Spark. Sign and submit to deposit collateral." },
      { name: "lending.borrow", use: "Generate unsigned borrow calldata. Variable rate only (stable deprecated). Check lending.risk.assess first." },
      { name: "lending.withdraw", use: "Generate unsigned withdraw calldata. Use 'max' to withdraw all supplied assets." },
      { name: "lending.repay", use: "Generate unsigned repay calldata. Use 'max' to repay all outstanding debt." },
      { name: "tx.receipt", use: "Fetch and decode a transaction receipt — success/failure, gas cost, events, token transfers. Close the execution loop." },
      { name: "strategy.carry.screen", use: "Screen all markets for positive carry (supply APY > borrow APY). Ranks self-funding leveraged strategies." },
      { name: "find.strategy", use: "Composable strategy finder — scans yield, carry, leverage, prediction, and gas data to surface the best opportunities for a given asset." },
      { name: "prediction.trending", use: "Top prediction markets by volume — probabilities, liquidity, and spread." },
      { name: "prediction.search", use: "Search prediction markets by topic." },
      { name: "prediction.book", use: "Order book depth and spread for a specific outcome token." },
      { name: "prediction.signals", use: "Detect actionable signals — wide spreads, extreme probabilities, volume spikes, mispricing." },
      { name: "alerts.watch", use: "Register a position for continuous health factor monitoring." },
      { name: "alerts.check", use: "Poll for active alerts (health factor warnings, rate spikes)." },
      { name: "alerts.list", use: "List all active position watches." },
      { name: "alerts.remove", use: "Remove a position watch." },
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
    description: `Get information about Syenite — the DeFi interface for AI agents. Swap/bridge routing, yield and lending, prediction markets, strategy search, alerts, wallet/gas, and trust-layer verification before signing.
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

  // ── lending.supply ──────────────────────────────────────────────────

  server.registerTool("lending.supply", {
    description: lendingSupplyDescription,
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
    inputSchema: {
      txHash: z.string().describe("Transaction hash to look up"),
      chain: z.string().default("ethereum").describe("Chain: ethereum, arbitrum, base, bsc (or chain ID)"),
    },
    outputSchema: txReceiptOutput,
  }, withLogging(clientIp, "tx.receipt", (p) =>
    handleTxReceipt(p as { txHash: string; chain?: string })
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
      webhookUrl: z
        .string()
        .optional()
        .describe("HTTP(S) URL to POST alert payloads to in real-time. Enables push-based alerting instead of polling."),
    },
    outputSchema: alertWatchOutput,
  }, withLogging(
    clientIp,
    "alerts.watch",
    (p) => handleAlertWatch(p as { address: string; protocol?: string; chain?: string; healthFactorThreshold?: number; webhookUrl?: string }),
    (p) => ({ address: "***", protocol: p.protocol, chain: p.chain, healthFactorThreshold: p.healthFactorThreshold, webhookUrl: p.webhookUrl ? "[set]" : undefined })
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

  // ── metamorpho.supply (ERC-4626 deposit into curated vault) ────────

  server.registerTool("metamorpho.supply", {
    description: metaMorphoSupplyDescription,
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

  return server;
}
