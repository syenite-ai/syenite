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
    type: z.enum(["lending", "prediction"]),
    address: z.string(),
    protocol: z.string(),
    chain: z.string(),
    healthFactorThreshold: z.number(),
    question: z.string().optional(),
    slug: z.string().optional(),
    conditions: z.record(z.string(), z.unknown()).optional(),
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

// ── wallet.balances ─────────────────────────────────────────────────

const ChainBalanceItem = z.object({
  chain: z.string(),
  native: z.object({
    symbol: z.string(),
    balance: z.string().describe("Formatted balance (e.g. '0.033')"),
    balanceRaw: z.string().describe("Raw balance in smallest unit (wei)"),
  }),
  tokens: z.array(z.object({
    symbol: z.string(),
    balance: z.string(),
    balanceRaw: z.string(),
  })).describe("Non-zero ERC-20 token balances"),
});

export const walletBalancesOutput = z.object({
  address: z.string(),
  chainsQueried: z.array(z.string()),
  balances: z.array(ChainBalanceItem),
  hasAnyBalance: z.boolean().describe("True if any chain has a non-zero balance"),
  timestamp: z.string(),
  note: z.string(),
});

// ── gas.estimate ────────────────────────────────────────────────────

const GasOperation = z.object({
  gasUnits: z.number(),
  costNative: z.string().describe("Cost in native token (e.g. '0.00042 ETH')"),
  costApproxUSD: z.string().describe("Approximate USD cost"),
});

const ChainGasItem = z.object({
  chain: z.string(),
  nativeSymbol: z.string(),
  gasPrice: z.object({
    gwei: z.string(),
    wei: z.string(),
  }),
  operations: z.record(z.string(), GasOperation),
});

export const gasEstimateOutput = z.object({
  chainsQueried: z.array(z.string()),
  estimates: z.array(ChainGasItem),
  cheapestChain: z.record(z.string(), z.object({
    chain: z.string(),
    costUSD: z.string(),
  })).describe("Cheapest chain for each operation type"),
  availableOperations: z.array(z.string()),
  timestamp: z.string(),
  note: z.string(),
});

// ── prediction.signals ──────────────────────────────────────────────

export const predictionSignalsOutput = z.object({
  source: z.string(),
  marketsScanned: z.number(),
  signalCount: z.number(),
  typeCounts: z.record(z.string(), z.number()),
  signals: z.array(z.record(z.string(), z.unknown())).describe("Ranked signals — each has type, strength, market, question, action, and signal-specific data"),
  signalTypes: z.record(z.string(), z.string()).describe("Legend: signal type → description"),
  timestamp: z.string(),
  note: z.string(),
});

// ── find.strategy ───────────────────────────────────────────────────

const StrategyItem = z.object({
  rank: z.number(),
  name: z.string(),
  category: z.enum(["yield", "carry", "leverage", "prediction", "arbitrage"]),
  expectedAPY: z.number().describe("Expected annual return as percentage"),
  risk: z.enum(["low", "medium", "high"]),
  summary: z.string().describe("Human-readable strategy description"),
  details: z.record(z.string(), z.unknown()),
  executionSteps: z.array(z.string()).describe("Ordered steps to execute this strategy"),
  tools: z.array(z.string()).describe("Syenite tools to call for execution"),
});

export const findStrategyOutput = z.object({
  query: z.object({
    asset: z.string(),
    amount: z.number(),
    riskTolerance: z.string(),
    chain: z.string(),
    includePrediction: z.boolean(),
  }),
  summary: z.object({
    strategiesFound: z.number(),
    bestStrategy: z.object({
      name: z.string(),
      expectedAPY: z.number(),
      risk: z.string(),
      category: z.string(),
    }).nullable(),
    categoryCounts: z.record(z.string(), z.number()),
    gasContext: z.object({
      cheapestSwapChain: z.string().optional(),
      swapGasCost: z.string().optional(),
      cheapestLendingChain: z.string().optional(),
      lendingGasCost: z.string().optional(),
    }).optional(),
  }),
  strategies: z.array(StrategyItem),
  timestamp: z.string(),
  note: z.string(),
});

// ── swap.multi ──────────────────────────────────────────────────────

export const swapMultiOutput = z.object({
  requestCount: z.number(),
  successCount: z.number(),
  failedCount: z.number(),
  totalCosts: z.object({
    gasCostUSD: z.string(),
    feesUSD: z.string(),
    totalUSD: z.string(),
  }),
  quotes: z.array(z.record(z.string(), z.unknown())).describe("Individual quote results — each has index, status, and full quote data or error"),
  timestamp: z.string(),
  note: z.string(),
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

// ── v0.6 Track C ────────────────────────────────────────────────────

const HistoryStatsShape = z.object({
  pointCount: z.number(),
  openPrice: z.number(),
  closePrice: z.number(),
  minPrice: z.number(),
  maxPrice: z.number(),
  changePct: z.number(),
}).nullable();

export const predictionMarketOutput = z.object({
  source: z.string().optional(),
  identifier: z.string().optional().describe("Present when the market was not found"),
  error: z.string().optional(),
  market: z.object({
    id: z.string(),
    slug: z.string(),
    conditionId: z.string(),
    question: z.string(),
    description: z.string(),
    resolutionCriteria: z.string(),
    active: z.boolean(),
    closed: z.boolean(),
    endDate: z.string().nullable(),
    hoursToClose: z.number().nullable(),
    outcomes: z.array(z.object({
      name: z.string(),
      tokenId: z.string().nullable(),
      currentPrice: z.number(),
      probabilityPct: z.number(),
    })),
  }).optional(),
  oddsHistory: z.object({
    "24h": HistoryStatsShape,
    "7d": HistoryStatsShape,
    "30d": HistoryStatsShape,
  }).optional(),
  volume: z.object({
    total: z.number(),
    volume24h: z.number(),
  }).optional(),
  liquidity: z.object({
    totalUSD: z.number(),
    bestBid: z.number(),
    bestAsk: z.number(),
    spread: z.number(),
    spreadBps: z.number(),
    bidDepthUSD: z.number(),
    askDepthUSD: z.number(),
    flow: z.object({
      direction: z.enum(["bid-heavy", "ask-heavy", "balanced"]),
      ratio: z.number(),
    }),
  }).optional(),
  impliedProbabilityPct: z.number().nullable().optional(),
  fairValue: z.object({ note: z.string() }).optional(),
  timestamp: z.string(),
  note: z.string().optional(),
});

const PredictionConditionsSchema = z.object({
  oddsThresholdPct: z.number().min(0).max(100).optional(),
  oddsMovePct: z.object({
    delta: z.number().positive(),
    windowMinutes: z.number().positive(),
  }).optional(),
  liquidityDropPct: z.number().min(0).max(100).optional(),
  resolutionApproachingHours: z.number().positive().optional(),
  volumeSpikeMultiple: z.number().gt(1).optional(),
});

export const predictionWatchOutput = z.object({
  watch: z.object({
    id: z.string(),
    type: z.literal("prediction"),
    marketId: z.string().optional(),
    conditionId: z.string().optional(),
    slug: z.string().optional(),
    question: z.string().optional(),
    conditions: PredictionConditionsSchema.optional(),
    webhookUrl: z.string().optional(),
    createdAt: z.string(),
  }),
  message: z.string(),
  usage: z.string(),
});

export const predictionPositionOutput = z.object({
  source: z.string(),
  address: z.string(),
  summary: z.object({
    positionCount: z.number(),
    totalInitialValueUSD: z.number(),
    totalCurrentValueUSD: z.number(),
    totalUnrealizedPnlUSD: z.number(),
    totalRealizedPnlUSD: z.number(),
  }),
  positions: z.array(z.object({
    marketId: z.string(),
    tokenId: z.string(),
    question: z.string(),
    slug: z.string(),
    outcome: z.string(),
    outcomeIndex: z.number(),
    size: z.number(),
    avgPrice: z.number(),
    currentPrice: z.number(),
    initialValueUSD: z.number(),
    currentValueUSD: z.number(),
    realizedPnlUSD: z.number(),
    unrealizedPnlUSD: z.number(),
    percentPnl: z.number(),
    endDate: z.string().nullable(),
    hoursToResolve: z.number().nullable(),
    redeemable: z.boolean(),
  })),
  timestamp: z.string(),
  note: z.string(),
});

export const predictionQuoteOutput = z.object({
  tokenId: z.string(),
  side: z.enum(["buy", "sell"]),
  outcome: z.enum(["YES", "NO"]),
  size: z.number(),
  orderType: z.enum(["market", "limit"]).optional(),
  midPrice: z.number().optional(),
  avgFillPrice: z.number().optional(),
  expectedFill: z.object({
    size: z.number(),
    totalCostUSD: z.number(),
    levelsConsumed: z.number(),
    fullyFilled: z.boolean(),
  }).optional(),
  slippagePct: z.number().optional(),
  slippageBps: z.number().optional(),
  depthAvailable: z.number().optional(),
  fees: z.object({
    makerBps: z.number(),
    takerBps: z.number(),
    estimatedUSD: z.number(),
    note: z.string(),
  }).optional(),
  limitCheck: z.object({
    limitPrice: z.number(),
    respectsLimit: z.boolean(),
  }).nullable().optional(),
  warnings: z.array(z.string()).optional(),
  error: z.string().optional(),
  timestamp: z.string(),
  note: z.string().optional(),
});

export const predictionOrderOutput = z.object({
  source: z.string(),
  mode: z.literal("eip712_offchain_order"),
  notice: z.string(),
  order: z.object({
    tokenId: z.string(),
    outcome: z.enum(["YES", "NO"]),
    side: z.enum(["buy", "sell"]),
    size: z.number(),
    price: z.number(),
    midPriceAtQuote: z.number(),
    maker: z.string(),
    expiration: z.number(),
    chainId: z.number(),
    verifyingContract: z.string(),
  }),
  typedData: z.object({
    domain: z.record(z.string(), z.unknown()),
    types: z.record(z.string(), z.array(z.object({ name: z.string(), type: z.string() }))),
    primaryType: z.string(),
    message: z.record(z.string(), z.union([z.string(), z.number()])),
  }),
  submission: z.object({
    endpoint: z.string(),
    method: z.string(),
    body: z.record(z.string(), z.unknown()),
    authHeaders: z.array(z.string()),
    docs: z.string(),
  }),
  approvalRequired: z.object({
    note: z.string(),
    tokenAddress: z.string(),
    spender: z.string(),
    amount: z.string(),
    chainId: z.number(),
  }),
  timestamp: z.string(),
});
