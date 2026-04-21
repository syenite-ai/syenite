import {
  addWatch,
  type PredictionConditions,
} from "../data/alerts.js";
import { getMarketDetail, getOrderBook } from "../data/polymarket.js";
import { SyeniteError } from "../errors.js";

export const predictionWatchDescription = `Registers a persistent background monitor for a specific Polymarket market that fires alerts when user-defined conditions are met. Supported conditions (at least one required): oddsThresholdPct (fire when implied probability crosses a target level), oddsMovePct (fire when probability moves by a delta% within a windowMinutes window), liquidityDropPct (fire when liquidity falls by a percentage from baseline), resolutionApproachingHours (fire when the market closes within N hours), and volumeSpikeMultiple (fire when 24h volume exceeds baseline by a multiple). Requires either slug or conditionId to identify the market (both returned by prediction.trending and prediction.search); optionally provide webhookUrl to receive POST payloads when conditions fire. Triggered alerts flow through alerts.check; use the returned watch ID with alerts.remove to stop monitoring. Does not place or cancel orders.`;

function hasAnyCondition(c: PredictionConditions): boolean {
  return (
    c.oddsThresholdPct !== undefined ||
    c.oddsMovePct !== undefined ||
    c.liquidityDropPct !== undefined ||
    c.resolutionApproachingHours !== undefined ||
    c.volumeSpikeMultiple !== undefined
  );
}

function validateConditions(c: PredictionConditions): void {
  if (!hasAnyCondition(c)) {
    throw SyeniteError.invalidInput("conditions must include at least one trigger.");
  }
  if (c.oddsThresholdPct !== undefined && (c.oddsThresholdPct < 0 || c.oddsThresholdPct > 100)) {
    throw SyeniteError.invalidInput("oddsThresholdPct must be between 0 and 100.");
  }
  if (c.oddsMovePct) {
    if (c.oddsMovePct.delta <= 0 || c.oddsMovePct.delta > 100) {
      throw SyeniteError.invalidInput("oddsMovePct.delta must be between 0 and 100.");
    }
    if (c.oddsMovePct.windowMinutes <= 0 || c.oddsMovePct.windowMinutes > 10_080) {
      throw SyeniteError.invalidInput("oddsMovePct.windowMinutes must be between 1 and 10080 (7d).");
    }
  }
  if (c.liquidityDropPct !== undefined && (c.liquidityDropPct <= 0 || c.liquidityDropPct > 100)) {
    throw SyeniteError.invalidInput("liquidityDropPct must be between 0 and 100.");
  }
  if (c.resolutionApproachingHours !== undefined && c.resolutionApproachingHours <= 0) {
    throw SyeniteError.invalidInput("resolutionApproachingHours must be positive.");
  }
  if (c.volumeSpikeMultiple !== undefined && c.volumeSpikeMultiple <= 1) {
    throw SyeniteError.invalidInput("volumeSpikeMultiple must be greater than 1.");
  }
}

export async function handlePredictionWatch(params: {
  slug?: string;
  conditionId?: string;
  conditions: PredictionConditions;
  webhookUrl?: string;
}): Promise<Record<string, unknown>> {
  const identifier = params.slug ?? params.conditionId;
  if (!identifier) {
    throw SyeniteError.invalidInput("One of slug or conditionId is required.");
  }
  validateConditions(params.conditions ?? {});

  if (params.webhookUrl && !/^https?:\/\//.test(params.webhookUrl)) {
    throw SyeniteError.invalidInput("webhookUrl must be an http(s) URL.");
  }

  const market = await getMarketDetail(identifier);
  if (!market) {
    throw SyeniteError.notFound(`Market "${identifier}" not found on Polymarket.`);
  }

  const tokenId = market.clobTokenIds?.[0];
  const book = tokenId ? await getOrderBook(tokenId) : null;
  const baselineOddsPct = book && Number.isFinite(book.midPrice)
    ? book.midPrice * 100
    : Number(market.outcomePrices[0] ?? 0) * 100;

  const watch = await addWatch({
    type: "prediction",
    address: market.conditionId,
    marketId: market.id,
    conditionId: market.conditionId,
    slug: market.slug,
    tokenId: tokenId ?? undefined,
    outcome: market.outcomes[0],
    question: market.question,
    predictionConditions: params.conditions,
    predictionState: {
      lastOddsPct: baselineOddsPct,
      lastOddsAt: new Date().toISOString(),
      baselineLiquidity: market.liquidity,
      baselineVolume24h: market.volume24hr ?? 0,
    },
    webhookUrl: params.webhookUrl,
    healthFactorThreshold: 0,
  });

  return {
    watch: {
      id: watch.id,
      type: watch.type,
      marketId: watch.marketId,
      conditionId: watch.conditionId,
      slug: watch.slug,
      question: watch.question,
      conditions: watch.predictionConditions,
      webhookUrl: watch.webhookUrl,
      createdAt: watch.createdAt,
    },
    message: `Now watching "${market.question}". Conditions evaluated on every alerts.check.`,
    usage: "Poll alerts.check to retrieve triggered alerts. Use alerts.remove with this watch ID to stop.",
  };
}
