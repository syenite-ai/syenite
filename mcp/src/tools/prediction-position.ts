import { isAddress } from "viem";
import { getUserPositions } from "../data/polymarket.js";
import { SyeniteError } from "../errors.js";

export const predictionPositionDescription = `Returns all open and recently resolved Polymarket positions for a given Polygon EOA address, including size in outcome shares, average entry price, current market price, realized and unrealized P&L in USDC, percentage P&L, and hours remaining until resolution for each market. Use this to audit an agent's prediction market exposure, calculate portfolio value, or identify positions that are redeemable. Requires a valid Polygon EVM address (0x-prefixed, 40 hex chars); read-only via Polymarket data API — no signing or wallet connection required. Does not place or cancel orders.`;

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function hoursUntil(endDate?: string): number | null {
  if (!endDate) return null;
  const diffMs = new Date(endDate).getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return null;
  return round(Math.max(0, diffMs / 3_600_000), 1);
}

export async function handlePredictionPosition(params: {
  address: string;
}): Promise<Record<string, unknown>> {
  if (!params.address || !isAddress(params.address)) {
    throw SyeniteError.invalidInput(`"${params.address}" is not a valid EVM address.`);
  }

  const positions = await getUserPositions(params.address);

  const summary = {
    positionCount: positions.length,
    totalInitialValueUSD: round(positions.reduce((s, p) => s + p.initialValue, 0)),
    totalCurrentValueUSD: round(positions.reduce((s, p) => s + p.currentValue, 0)),
    totalUnrealizedPnlUSD: round(positions.reduce((s, p) => s + p.unrealizedPnl, 0)),
    totalRealizedPnlUSD: round(positions.reduce((s, p) => s + p.realizedPnl, 0)),
  };

  return {
    source: "Polymarket",
    address: params.address,
    summary,
    positions: positions.map((p) => ({
      marketId: p.conditionId,
      tokenId: p.asset,
      question: p.title,
      slug: p.slug,
      outcome: p.outcome,
      outcomeIndex: p.outcomeIndex,
      size: round(p.size, 4),
      avgPrice: round(p.avgPrice, 4),
      currentPrice: round(p.currentPrice, 4),
      initialValueUSD: round(p.initialValue),
      currentValueUSD: round(p.currentValue),
      realizedPnlUSD: round(p.realizedPnl),
      unrealizedPnlUSD: round(p.unrealizedPnl),
      percentPnl: round(p.percentPnl, 2),
      endDate: p.endDate ?? null,
      hoursToResolve: hoursUntil(p.endDate),
      redeemable: p.redeemable ?? false,
    })),
    timestamp: new Date().toISOString(),
    note: "Prices in USDC (0-1 range per outcome share). Positions <$1 filtered by sizeThreshold=0.",
  };
}
