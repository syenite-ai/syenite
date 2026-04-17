import { getAllMetaMorphoVaults } from "./morpho.js";
import type { YieldOpportunity, VaultData } from "./types.js";

function vaultRiskNotes(v: VaultData): string {
  const topCollats = v.topMarkets
    .slice(0, 3)
    .map((m) => m.collateral)
    .filter((c) => c && c !== "unknown");
  const composition = topCollats.length > 0 ? ` Top collateral: ${topCollats.join(", ")}.` : "";
  return `Curated by ${v.curator}. ${v.marketCount} underlying Morpho Blue markets.${composition} ERC-4626 vault — instant withdrawals subject to underlying liquidity. Fee ${(v.feeBps / 100).toFixed(2)}%.`;
}

function metaMorphoToYield(v: VaultData): YieldOpportunity {
  return {
    protocol: "Morpho",
    product: `MetaMorpho ${v.name} (${v.chain})`,
    asset: v.asset,
    apy: v.netAPY,
    apyType: "variable",
    tvlUSD: v.tvlUSD,
    category: "vault",
    risk: "low",
    riskNotes: vaultRiskNotes(v),
    lockup: "none",
    lastUpdated: v.lastUpdated,
  };
}

/** Emit MetaMorpho curated-vault yield opportunities across all supported chains. */
export async function getMetaMorphoYields(): Promise<YieldOpportunity[]> {
  const vaults = await getAllMetaMorphoVaults();
  return vaults.map(metaMorphoToYield);
}
