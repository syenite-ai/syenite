import { z } from "zod";

// ── Shared sub-schemas ──────────────────────────────────────────────

const MarketRate = z.object({
  protocol: z.string().describe("Protocol identifier (aave-v3, morpho-blue, spark)"),
  chain: z.string().describe("Chain: ethereum, arbitrum, base"),
  market: z.string().describe("Human-readable market name"),
  collateral: z.string().describe("Collateral asset symbol"),
  borrowAPY: z.number().describe("Annual borrow rate (%)"),
  supplyAPY: z.number().describe("Annual supply rate (%)"),
  availableLiquidityUSD: z.number().describe("Available liquidity in USD"),
  utilization: z.number().describe("Pool utilization (%)"),
  maxLTV: z.number().describe("Maximum loan-to-value ratio (%)"),
  liquidationThreshold: z.number().describe("Liquidation threshold (%)"),
  liquidationPenalty: z.number().describe("Liquidation penalty (%)"),
});

const YieldOpportunityItem = z.object({
  protocol: z.string().describe("Protocol name — pass to yield.assess for deep risk analysis"),
  product: z.string().describe("Product name — pass to yield.assess as 'product' for exact match"),
  asset: z.string().describe("Deposited asset symbol"),
  apy: z.number().describe("Current annual percentage yield (%)"),
  apyType: z.enum(["variable", "fixed", "trailing-7d", "estimated"]),
  tvlUSD: z.number().describe("Total value locked in USD"),
  category: z.enum(["lending-supply", "liquid-staking", "vault", "savings-rate", "basis-capture"]),
  risk: z.enum(["low", "medium", "high"]),
  riskNotes: z.string(),
  lockup: z.string().describe("Lock period (e.g. 'none', '7 days')"),
});

// ── syenite.help ────────────────────────────────────────────────────

export const helpOutput = z.object({
  service: z.string(),
  description: z.string(),
  tools: z.array(z.object({ name: z.string(), use: z.string() })),
  swapAndBridge: z.object({
    chains: z.string(),
    routing: z.string(),
    execution: z.string(),
  }),
  yieldSources: z.record(z.string(), z.array(z.string())),
  lendingProtocols: z.array(z.string()),
  access: z.object({
    status: z.string(),
    rateLimit: z.string(),
    endpoint: z.string(),
  }),
  website: z.string(),
});

// ── lending.rates.query ─────────────────────────────────────────────

export const ratesOutput = z.object({
  query: z.object({
    collateral: z.string(),
    borrowAsset: z.string(),
    chain: z.string(),
  }),
  bestBorrowRate: z.object({
    protocol: z.string(),
    chain: z.string(),
    market: z.string(),
    borrowAPY: z.number(),
  }).nullable().describe("Best rate found, or null if no markets match"),
  markets: z.array(MarketRate).describe("All matching lending markets, sorted by borrow APY"),
  timestamp: z.string(),
  note: z.string(),
});

// ── lending.market.overview ─────────────────────────────────────────

export const marketOverviewOutput = z.object({
  query: z.object({ collateral: z.string() }),
  crossProtocol: z.object({
    totalMarketsScanned: z.number(),
    lowestBorrowAPY: z.number(),
    highestSupplyAPY: z.number(),
    totalAvailableLiquidityUSD: z.number(),
  }),
  protocols: z.array(z.object({
    protocol: z.string(),
    marketCount: z.number(),
    totalSupplyUSD: z.number(),
    totalBorrowUSD: z.number(),
    availableLiquidityUSD: z.number(),
    utilization: z.number().describe("Aggregate utilization (%)"),
    borrowAPYRange: z.object({ min: z.number(), max: z.number() }),
    supplyAPYRange: z.object({ min: z.number(), max: z.number() }),
    markets: z.array(z.object({
      market: z.string(),
      collateral: z.string(),
      borrowAPY: z.number(),
      supplyAPY: z.number(),
      utilization: z.number(),
      availableLiquidityUSD: z.number(),
      liquidationPenalty: z.number(),
    })),
  })),
  timestamp: z.string(),
});

// ── lending.position.monitor ────────────────────────────────────────

export const positionMonitorOutput = z.object({
  address: z.string(),
  positionCount: z.number(),
  warning: z.string().optional().describe("Present when positions are approaching liquidation"),
  positions: z.array(z.object({
    protocol: z.string(),
    market: z.string(),
    collateral: z.object({
      asset: z.string(),
      amount: z.number(),
      valueUSD: z.number(),
    }),
    debt: z.object({
      asset: z.string(),
      amount: z.number(),
      valueUSD: z.number(),
    }),
    currentLTV: z.number().describe("Current loan-to-value ratio (%)"),
    healthFactor: z.union([z.number(), z.string()]).describe("Numeric health factor, or 'safe (no debt)'"),
    liquidationPrice: z.number().describe("Collateral price at which liquidation triggers (USD)"),
    distanceToLiquidationPct: z.number().describe("Percentage price drop to reach liquidation"),
    distanceToLiquidation: z.string().describe("Formatted distance string"),
    borrowRateAPY: z.number(),
    estimatedAnnualCost: z.number().describe("Annual borrow cost in USD"),
  })),
  timestamp: z.string(),
});

// ── lending.risk.assess ─────────────────────────────────────────────

export const riskAssessOutput = z.object({
  query: z.object({
    collateral: z.string(),
    collateralAmount: z.number(),
    collateralValueUSD: z.number(),
    borrowAsset: z.string(),
    borrowAmount: z.number(),
    targetLTV: z.number(),
    assetPrice: z.number(),
  }),
  assessment: z.object({
    riskScore: z.number().min(1).max(10).describe("Risk score: 1 = lowest, 10 = highest"),
    recommendedProtocol: z.string().describe("Best protocol/market for this position"),
    recommendedLTV: z.number(),
    liquidationPrice: z.number(),
    liquidationPenalty: z.number(),
    distanceToLiquidation: z.number().describe("% price drop to liquidation"),
    positionSizing: z.object({
      poolLiquidityRatio: z.number(),
      borrowAsPoolPercent: z.number(),
      warning: z.string().nullable(),
    }),
    collateralRisk: z.object({
      level: z.string(),
      notes: z.string(),
    }),
    protocolRisk: z.object({
      oracleType: z.string(),
      liquidationMechanism: z.string(),
      governance: z.string(),
      notes: z.string(),
    }),
    estimatedAnnualCost: z.number().describe("Annual borrow cost in USD"),
    autoUnwindRecommended: z.boolean(),
    summary: z.string(),
  }),
  alternativeMarkets: z.array(z.object({
    market: z.string(),
    borrowAPY: z.number(),
    liquidationPenalty: z.number(),
    availableLiquidityUSD: z.number(),
  })),
  timestamp: z.string(),
});

// ── yield.opportunities ─────────────────────────────────────────────

export const yieldOpportunitiesOutput = z.object({
  query: z.object({
    asset: z.string(),
    category: z.string(),
    riskTolerance: z.string(),
  }),
  summary: z.object({
    totalOpportunities: z.number(),
    bestAPY: z.object({
      protocol: z.string(),
      product: z.string(),
      apy: z.number(),
      risk: z.string(),
    }).nullable(),
    bestLowRiskAPY: z.object({
      protocol: z.string(),
      product: z.string(),
      apy: z.number(),
    }).optional(),
    categoryCounts: z.object({
      "lending-supply": z.number(),
      "liquid-staking": z.number(),
      vault: z.number(),
      "savings-rate": z.number(),
      "basis-capture": z.number(),
    }),
  }),
  opportunities: z.array(YieldOpportunityItem),
  timestamp: z.string(),
  note: z.string(),
});

// ── yield.assess ────────────────────────────────────────────────────

export const yieldAssessOutput = z.object({
  query: z.object({
    protocol: z.string(),
    product: z.string().optional(),
    amount: z.number(),
    asset: z.string(),
  }),
  source: z.object({
    protocol: z.string(),
    product: z.string(),
    asset: z.string(),
    apy: z.number(),
    apyType: z.string(),
    tvlUSD: z.number(),
    category: z.string(),
    lockup: z.string(),
  }),
  riskAssessment: z.object({
    riskScore: z.number().min(1).max(10),
    riskLevel: z.enum(["low", "medium", "high"]),
    smartContract: z.string(),
    oracle: z.string(),
    governance: z.string(),
    liquidity: z.string(),
    depegRisk: z.string(),
    positionSizing: z.object({
      percentOfTVL: z.number(),
      warning: z.string().nullable(),
    }),
  }),
  projectedReturn: z.object({
    annualYieldUSD: z.number(),
    monthlyYieldUSD: z.number(),
    note: z.string(),
  }).optional().describe("Present when an amount was provided"),
  alternatives: z.array(z.object({
    protocol: z.string(),
    product: z.string(),
    apy: z.number(),
    risk: z.string(),
    category: z.string(),
  })),
  timestamp: z.string(),
});

// ── alerts.watch ─────────────────────────────────────────────────────

export const alertWatchOutput = z.object({
  watch: z.object({
    id: z.string(),
    address: z.string(),
    protocol: z.string().optional(),
    chain: z.string().optional(),
    healthFactorThreshold: z.number(),
    createdAt: z.string(),
  }),
  message: z.string(),
  usage: z.string(),
});

export const alertCheckOutput = z.object({
  alertCount: z.number(),
  critical: z.number(),
  warnings: z.number(),
  alerts: z.array(z.object({
    watchId: z.string(),
    type: z.string(),
    severity: z.enum(["warning", "critical"]),
    message: z.string(),
    data: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
  })),
  timestamp: z.string(),
});

export const alertListOutput = z.object({
  watchCount: z.number(),
  watches: z.array(z.object({
    id: z.string(),
    address: z.string(),
    protocol: z.string(),
    chain: z.string(),
    healthFactorThreshold: z.number(),
    createdAt: z.string(),
    lastCheckedAt: z.string(),
  })),
  timestamp: z.string(),
});

export const alertRemoveOutput = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ── strategy.carry.screen ────────────────────────────────────────────

export const carryScreenerOutput = z.object({
  query: z.object({
    collateral: z.string(),
    borrowAsset: z.string(),
    chain: z.string(),
    minCarry: z.number().optional(),
    positionSizeUSD: z.number(),
  }),
  summary: z.object({
    totalMarketsScanned: z.number(),
    positiveCarryCount: z.number(),
    bestCarry: z.object({
      market: z.string(),
      netCarry: z.number(),
      leveragedCarry: z.number(),
      estimatedAnnualReturnUSD: z.number(),
    }).nullable(),
  }),
  strategies: z.array(z.object({
    protocol: z.string(),
    chain: z.string(),
    market: z.string(),
    collateral: z.string(),
    borrowAsset: z.string(),
    supplyAPY: z.number(),
    borrowAPY: z.number(),
    netCarry: z.number().describe("Supply APY minus borrow APY"),
    maxLTV: z.number(),
    leveragedCarry: z.number().describe("Net carry amplified at safe leverage"),
    liquidationPenalty: z.number(),
    availableLiquidityUSD: z.number(),
    utilization: z.number(),
    estimatedAnnualReturnUSD: z.number(),
  })),
  timestamp: z.string(),
  note: z.string(),
});

// ── prediction.trending ──────────────────────────────────────────────

const PredictionOutcome = z.object({
  name: z.string(),
  probability: z.number().describe("Probability as percentage (0-100)"),
});

const PredictionMarketItem = z.object({
  id: z.string(),
  question: z.string(),
  conditionId: z.string(),
  outcomes: z.array(PredictionOutcome),
  volume: z.number().describe("Trading volume in USDC"),
  liquidity: z.number().describe("Available liquidity in USDC"),
  bestBid: z.number(),
  bestAsk: z.number(),
  spread: z.number(),
  lastTradePrice: z.number(),
});

const PredictionEvent = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  active: z.boolean(),
  volume: z.number(),
  liquidity: z.number(),
  markets: z.array(PredictionMarketItem),
});

export const predictionTrendingOutput = z.object({
  source: z.string(),
  eventCount: z.number(),
  events: z.array(PredictionEvent),
  timestamp: z.string(),
  note: z.string(),
});

export const predictionSearchOutput = z.object({
  source: z.string(),
  query: z.string(),
  resultCount: z.number(),
  events: z.array(PredictionEvent),
  timestamp: z.string(),
});

export const predictionBookOutput = z.object({
  tokenId: z.string(),
  midPrice: z.number().optional(),
  spread: z.number().optional(),
  spreadBps: z.number().optional().describe("Spread in basis points"),
  bidDepthUSD: z.number().optional(),
  askDepthUSD: z.number().optional(),
  bids: z.array(z.object({ price: z.number(), size: z.number() })).optional(),
  asks: z.array(z.object({ price: z.number(), size: z.number() })).optional(),
  error: z.string().optional(),
  timestamp: z.string(),
  note: z.string().optional(),
});

// ── swap.quote ──────────────────────────────────────────────────────

export const swapQuoteOutput = z.object({
  type: z.enum(["swap", "bridge"]),
  summary: z.string().describe("Human-readable summary, e.g. '1.5 WETH → 3500 USDC'"),
  quote: z.object({
    fromToken: z.string(),
    toToken: z.string(),
    fromAmount: z.string(),
    expectedOutput: z.string(),
    minimumOutput: z.string(),
    fromChain: z.string(),
    toChain: z.string(),
  }),
  route: z.array(z.string()).describe("Ordered routing steps"),
  costs: z.object({
    gasCostUSD: z.string(),
    fees: z.array(z.object({
      name: z.string(),
      percentage: z.string(),
      amountUSD: z.string(),
    })),
  }),
  estimatedTime: z.string(),
  warnings: z.array(z.string()).optional().describe("Risk warnings (slippage, gas, cross-chain)"),
  execution: z.object({
    instructions: z.string(),
    transactionRequest: z.object({
      to: z.string(),
      data: z.string(),
      value: z.string(),
      gasLimit: z.string(),
      chainId: z.number(),
    }),
  }),
  approvalRequired: z.object({
    note: z.string(),
    tokenAddress: z.string(),
    spender: z.string(),
    amount: z.string(),
  }).optional().describe("Present when token approval is needed before the swap"),
  tracking: z.string().optional().describe("Present for cross-chain bridges — use swap.status to track"),
  note: z.string(),
});

// ── swap.status ─────────────────────────────────────────────────────

export const swapStatusOutput = z.object({
  status: z.enum(["NOT_FOUND", "PENDING", "DONE", "FAILED"]),
  substatus: z.string().optional(),
  fromChain: z.string(),
  toChain: z.string(),
  sendingTxHash: z.string(),
  receivingTxHash: z.string().optional().describe("Present when destination tx is confirmed"),
  amountReceived: z.string().optional().describe("Present when transfer is complete"),
  bridge: z.string().optional(),
  message: z.string().describe("Human-readable status explanation"),
  note: z.string(),
});
