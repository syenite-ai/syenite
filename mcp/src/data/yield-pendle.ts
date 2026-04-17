import { getPendleMarkets, formatMaturityLockup } from "./pendle.js";
import type { YieldOpportunity } from "./types.js";

function ptRiskNotes(chain: string, underlyingAPY: number): string {
  const note = underlyingAPY > 0
    ? `Underlying floating APY ~${underlyingAPY.toFixed(2)}%. Lock in fixed by holding PT to maturity.`
    : "Fixed-rate principal token; redeems 1:1 for underlying at maturity.";
  return `${note} Pendle on ${chain}. Secondary-market exit has price risk before maturity.`;
}

function ytRiskNotes(chain: string): string {
  return `Leveraged exposure to floating yield on the underlying. High variance — value decays toward 0 at maturity. Pendle on ${chain}.`;
}

/**
 * Map active Pendle markets into yield opportunities.
 *
 * PT markets are emitted as fixed-APY lending-supply opportunities. YT markets
 * are only included when `includeYT` is true so they don't pollute vanilla
 * APY rankings.
 */
export async function getPendleYields(includeYT: boolean = false): Promise<YieldOpportunity[]> {
  const markets = await getPendleMarkets({});
  const now = new Date().toISOString();
  const opportunities: YieldOpportunity[] = [];

  for (const m of markets) {
    if (m.ptFixedAPY > 0) {
      opportunities.push({
        protocol: "Pendle",
        product: `PT-${m.underlying} (${m.chain})`,
        asset: m.underlying,
        apy: m.ptFixedAPY,
        apyType: "fixed",
        tvlUSD: m.tvlUSD,
        category: "lending-supply",
        risk: "medium",
        riskNotes: ptRiskNotes(m.chain, m.underlyingAPY),
        lockup: formatMaturityLockup(m.maturity),
        lastUpdated: now,
        maturity: m.maturity,
        tags: ["fixed-yield"],
      });
    }

    if (includeYT && m.ytImpliedAPY > 0) {
      opportunities.push({
        protocol: "Pendle",
        product: `YT-${m.underlying} (${m.chain})`,
        asset: m.underlying,
        apy: m.ytImpliedAPY,
        apyType: "variable",
        tvlUSD: m.tvlUSD,
        category: "lending-supply",
        risk: "high",
        riskNotes: ytRiskNotes(m.chain),
        lockup: formatMaturityLockup(m.maturity),
        lastUpdated: now,
        maturity: m.maturity,
        tags: ["yt", "leveraged-variable"],
      });
    }
  }

  return opportunities;
}
