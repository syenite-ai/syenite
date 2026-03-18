import { getAaveRates, getSparkRates } from "./aave.js";
import { getMorphoRates } from "./morpho.js";
import type { ProtocolRate, YieldOpportunity } from "./types.js";

function rateToYield(r: ProtocolRate): YieldOpportunity {
  const riskLevel = r.protocol === "morpho-blue" ? "medium" as const : "low" as const;
  const riskNotes =
    r.protocol === "morpho-blue"
      ? "Isolated market — risk confined to this pool. Immutable contracts, no admin keys."
      : r.protocol === "spark"
        ? "Aave v3 fork operated by Maker/Sky ecosystem. DAO governed with timelock."
        : "Largest DeFi lending protocol. DAO governed, battle-tested since 2020.";

  const protocolLabel = r.protocol === "aave-v3" ? "Aave v3" : r.protocol === "morpho-blue" ? "Morpho Blue" : "Spark";

  return {
    protocol: protocolLabel,
    product: `${protocolLabel} ${r.borrowAsset} Supply`,
    asset: r.borrowAsset,
    apy: r.borrowAssetSupplyAPY,
    apyType: "variable",
    tvlUSD: r.totalSupply,
    category: "lending-supply",
    risk: riskLevel,
    riskNotes,
    lockup: "none",
    lastUpdated: r.lastUpdated,
  };
}

export async function getLendingSupplyYields(assetFilter?: string): Promise<YieldOpportunity[]> {
  const borrowAssets = ["USDC", "USDT", "DAI", "GHO"];
  const targetAssets = assetFilter && assetFilter !== "all"
    ? borrowAssets.filter((a) => a.toLowerCase() === assetFilter.toLowerCase())
    : borrowAssets;

  if (targetAssets.length === 0 && assetFilter) {
    targetAssets.push("USDC");
  }

  const allYields: YieldOpportunity[] = [];

  for (const borrowAsset of targetAssets) {
    const [aave, morpho, spark] = await Promise.allSettled([
      getAaveRates("all", borrowAsset),
      getMorphoRates("all", borrowAsset),
      getSparkRates("all", borrowAsset),
    ]);

    const rates: ProtocolRate[] = [
      ...(aave.status === "fulfilled" ? aave.value : []),
      ...(morpho.status === "fulfilled" ? morpho.value : []),
      ...(spark.status === "fulfilled" ? spark.value : []),
    ];

    const seen = new Set<string>();
    for (const r of rates) {
      const key = `${r.protocol}:${r.borrowAsset}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (r.supplyAPY > 0) {
        allYields.push(rateToYield(r));
      }
    }
  }

  return allYields;
}
