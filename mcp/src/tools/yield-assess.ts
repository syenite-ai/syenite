import { getLendingSupplyYields } from "../data/yield-lending.js";
import { getMakerDSRYield } from "../data/yield-savings.js";
import { getStakingYields } from "../data/yield-staking.js";
import { getVaultYields } from "../data/yield-vaults.js";
import { getStructuredYields } from "../data/yield-structured.js";
import type { YieldOpportunity } from "../data/types.js";

export const yieldAssessToolName = "yield.assess";

export const yieldAssessToolDescription = `Assess the risk of a specific DeFi yield strategy before committing capital.
Returns risk breakdown: smart contract risk, oracle dependency, depeg/peg risk, liquidity/exit risk, position sizing vs TVL, protocol governance, and comparable alternatives.
Use this after yield.opportunities to evaluate a specific opportunity in depth.`;

const PROTOCOL_DEEP_RISK: Record<string, {
  smartContract: string;
  oracle: string;
  governance: string;
  liquidity: string;
  depeg: string;
}> = {
  "Aave v3": {
    smartContract: "Battle-tested since 2020. Multiple audits. $10B+ TVL with no major exploits on v3. Upgradeable proxy — governance can change logic.",
    oracle: "Chainlink price feeds with fallback mechanisms. Oracle manipulation risk is low given Chainlink's decentralized network.",
    governance: "Aave DAO with multi-day timelock. Parameter changes require governance vote. Emergency admin can pause but not drain.",
    liquidity: "Instant withdrawal if pool has available liquidity. Risk of illiquidity during high utilization events (borrow demand spike).",
    depeg: "Stablecoin supply positions track the underlying asset 1:1. No wrapper risk on the supply side.",
  },
  "Morpho Blue": {
    smartContract: "Immutable core contracts — no admin keys, no upgrades. Audited by Spearbit. Newer (2024) with growing TVL.",
    oracle: "Per-market oracles set at creation and immutable. Risk varies by market — check specific oracle type.",
    governance: "No governance on core protocol. Market parameters (LLTV, oracle) are fixed at creation. MetaMorpho vault curators manage allocation.",
    liquidity: "Instant withdrawal subject to available liquidity in the specific market. Isolated markets mean one market's issues don't affect others.",
    depeg: "Depends on the specific lending market's collateral quality. Supply-side risk is limited to borrower default in isolated markets.",
  },
  Spark: {
    smartContract: "Aave v3 fork maintained by Maker/Sky ecosystem. Benefits from Aave's battle-testing but separate deployment.",
    oracle: "Chainlink price feeds, same model as Aave v3.",
    governance: "Spark DAO (Maker ecosystem). Governance timelock on parameter changes.",
    liquidity: "Same model as Aave v3 — instant withdrawal subject to pool utilization.",
    depeg: "Focused on DAI/sDAI ecosystem. Maker governance exposure on the stablecoin side.",
  },
  Lido: {
    smartContract: "Largest staking protocol. Multiple audits. $30B+ TVL. Upgradeable contracts controlled by Lido DAO.",
    oracle: "Beacon chain oracle reports validator balances. Accounting oracle updates share rate. Robust but centralized oracle set.",
    governance: "Lido DAO (LDO token). Node operator set is curated — not fully permissionless.",
    liquidity: "wstETH is liquid on DEXs. No unstaking queue for secondary market sales. Direct unstaking takes variable time depending on Ethereum exit queue.",
    depeg: "stETH can trade at a discount to ETH during market stress (happened in 2022). wstETH compounds rebases and is less susceptible.",
  },
  "Rocket Pool": {
    smartContract: "Audited, permissionless node operator model. Smaller TVL than Lido but strong security track record.",
    oracle: "Exchange rate oracle updated by Rocket Pool protocol. Less centralized than Lido's oracle.",
    governance: "pDAO + oDAO dual governance. More decentralized than Lido.",
    liquidity: "rETH is liquid on DEXs. Can also burn rETH for ETH if protocol has sufficient deposit pool balance.",
    depeg: "rETH can trade at premium/discount. Generally closer to NAV due to arbitrage mechanisms.",
  },
  Coinbase: {
    smartContract: "Centralized wrapper managed by Coinbase. Not DeFi-native — single point of failure at Coinbase.",
    oracle: "Exchange rate set by Coinbase. Centralized rate reporting.",
    governance: "Coinbase corporate governance. No on-chain governance. Regulatory compliance provides some protection.",
    liquidity: "Liquid on DEXs and Coinbase exchange. Centralized redemption through Coinbase.",
    depeg: "cbETH can diverge from NAV. Coinbase regulatory risk could affect redemptions.",
  },
  "Maker / Sky": {
    smartContract: "One of the oldest DeFi protocols. Pot contract is simple and well-audited. Minimal attack surface.",
    oracle: "DSR rate is governance-set, not oracle-dependent. No oracle manipulation risk.",
    governance: "MakerDAO governance sets the DSR rate. Rate can change with governance votes — not guaranteed.",
    liquidity: "Instant deposit and withdrawal. sDAI is ERC4626 compliant. Deep liquidity.",
    depeg: "DAI peg risk. DAI is backed by diverse collateral including USDC — inherits some centralized stablecoin risk.",
  },
  Morpho: {
    smartContract: "MetaMorpho vaults are ERC4626 wrappers over Morpho Blue markets. Audited. Curator manages market allocation.",
    oracle: "Inherits oracle risk from underlying Morpho Blue markets. Diversified across multiple markets.",
    governance: "Vault curator (e.g., Steakhouse, Gauntlet) manages allocation. No core protocol governance risk.",
    liquidity: "Withdrawal depends on underlying market liquidity. Generally instant but can queue during high utilization.",
    depeg: "Supply-side exposure. Risk limited to borrower defaults in underlying Morpho Blue markets.",
  },
  Yearn: {
    smartContract: "Multi-strategy vaults with risk stacking. Audited but high complexity. Multiple underlying protocol dependencies.",
    oracle: "Strategy-dependent. Uses various oracles across underlying protocols.",
    governance: "Yearn governance manages strategy approval. Strategists manage individual vault allocations.",
    liquidity: "Generally liquid but withdrawal can be delayed if strategies are actively deployed.",
    depeg: "Depends on underlying strategy. Higher risk than single-protocol deposits due to complexity.",
  },
  Ethena: {
    smartContract: "Newer protocol (2024). Audited but limited track record. Off-exchange settlement (OES) adds custodial layer.",
    oracle: "Relies on CEX perpetual funding rates. Not purely on-chain — off-chain settlement introduces opacity.",
    governance: "Ethena Labs controls protocol parameters. Centralized governance with limited transparency on reserves.",
    liquidity: "7-day cooldown for sUSDe unstaking. USDe itself is liquid on DEXs but can depeg under stress.",
    depeg: "USDe peg depends on delta-neutral position maintenance. Negative funding rates, exchange insolvency, or custodian failure could break the peg. Highest risk category in the yield stack.",
  },
  Pendle: {
    smartContract: "Yield tokenization protocol. Audited. PT is a simple claim on underlying at maturity.",
    oracle: "Market-based pricing. PT price reflects implied yield via AMM. No external oracle dependency.",
    governance: "Pendle governance for protocol parameters. Market-specific parameters are set at creation.",
    liquidity: "Liquid before maturity via Pendle AMM. Slippage increases as maturity approaches and liquidity migrates. No liquidity risk if held to maturity.",
    depeg: "PT risk = underlying protocol risk. If the underlying yield source fails, PT may not redeem at full value.",
  },
};

export async function handleYieldAssess(params: {
  protocol: string;
  product?: string;
  amount?: number;
  asset?: string;
}): Promise<string> {
  const { protocol } = params;
  const amount = params.amount ?? 0;
  const asset = params.asset ?? "all";

  const [lending, savings, staking, vaults, structured] = await Promise.allSettled([
    getLendingSupplyYields(asset),
    getMakerDSRYield(),
    getStakingYields(),
    getVaultYields(),
    getStructuredYields(),
  ]);

  const allYields: YieldOpportunity[] = [
    ...(lending.status === "fulfilled" ? lending.value : []),
    ...(savings.status === "fulfilled" ? savings.value : []),
    ...(staking.status === "fulfilled" ? staking.value : []),
    ...(vaults.status === "fulfilled" ? vaults.value : []),
    ...(structured.status === "fulfilled" ? structured.value : []),
  ];

  const protocolFilter = protocol.toLowerCase();
  const match = allYields.find((y) => {
    if (y.protocol.toLowerCase().includes(protocolFilter)) return true;
    if (params.product && y.product.toLowerCase().includes(params.product.toLowerCase())) return true;
    return false;
  });

  if (!match) {
    return JSON.stringify({
      error: "not_found",
      message: `No yield source found matching protocol="${protocol}"${params.product ? `, product="${params.product}"` : ""}. Use yield.opportunities to see available sources.`,
    });
  }

  const deepRisk = PROTOCOL_DEEP_RISK[match.protocol] ?? {
    smartContract: "No detailed risk data available.",
    oracle: "Unknown oracle configuration.",
    governance: "Unknown governance model.",
    liquidity: "Unknown liquidity profile.",
    depeg: "Unknown peg risk.",
  };

  const positionVsTVL = match.tvlUSD > 0 && amount > 0
    ? (amount / match.tvlUSD) * 100
    : 0;

  let positionSizingWarning: string | null = null;
  if (positionVsTVL > 10) {
    positionSizingWarning = `Your deposit ($${round(amount)}) is ${round(positionVsTVL)}% of the protocol's TVL ($${round(match.tvlUSD)}). Extremely concentrated — liquidity risk is high.`;
  } else if (positionVsTVL > 1) {
    positionSizingWarning = `Your deposit is ${round(positionVsTVL)}% of TVL. Large position — may impact exit liquidity.`;
  }

  const alternatives = allYields
    .filter((y) => y.protocol !== match.protocol && y.asset.toLowerCase() === match.asset.toLowerCase())
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 5)
    .map((y) => ({
      protocol: y.protocol,
      product: y.product,
      apy: round(y.apy),
      risk: y.risk,
      category: y.category,
    }));

  const estimatedAnnualYield = amount > 0 ? amount * (match.apy / 100) : null;

  let riskScore = 1;
  if (match.risk === "medium") riskScore = 4;
  if (match.risk === "high") riskScore = 7;
  if (positionVsTVL > 1) riskScore += 1;
  if (positionVsTVL > 10) riskScore += 2;
  if (match.lockup !== "none") riskScore += 1;
  riskScore = Math.min(riskScore, 10);

  return JSON.stringify({
    query: { protocol, product: params.product, amount, asset },
    source: {
      protocol: match.protocol,
      product: match.product,
      asset: match.asset,
      apy: round(match.apy),
      apyType: match.apyType,
      tvlUSD: round(match.tvlUSD),
      category: match.category,
      lockup: match.lockup,
    },
    riskAssessment: {
      riskScore,
      riskLevel: match.risk,
      smartContract: deepRisk.smartContract,
      oracle: deepRisk.oracle,
      governance: deepRisk.governance,
      liquidity: deepRisk.liquidity,
      depegRisk: deepRisk.depeg,
      positionSizing: {
        percentOfTVL: round(positionVsTVL, 4),
        warning: positionSizingWarning,
      },
    },
    ...(estimatedAnnualYield !== null && {
      projectedReturn: {
        annualYieldUSD: round(estimatedAnnualYield),
        monthlyYieldUSD: round(estimatedAnnualYield / 12),
        note: "Based on current APY. Variable rates will fluctuate.",
      },
    }),
    alternatives,
    timestamp: new Date().toISOString(),
  });
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
