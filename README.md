# Syenite

Institutional lending infrastructure for BTC DeFi. Any wrapper, any protocol, any operator.

## What This Is

Syenite is the execution, risk, and management layer that sits between any BTC wrapper (tBTC, LBTC, cbBTC, wBTC) and any lending protocol (Aave, Morpho, Compound, Spark). It provides institutional-grade vault infrastructure — per-client isolated accounts with flash-loan liquidation protection, cross-protocol rebalancing, and a risk framework calibrated for BTC collateral.

## The Gap

| Capability | DeFi Saver | Sentora | Arcus | Morpho V2 | Syenite |
|---|---|---|---|---|---|
| Flash-loan auto-unwind | Yes | No | No | No | Yes |
| Cross-protocol rebalancing | Yes | No | No | No | Yes |
| Per-client vault isolation | No | No | Yes (CeFi) | No (pooled) | Yes |
| Institutional controls | No | Partial | Yes | Partial | Yes |
| BTC-specific risk framework | No | No | Partial | No | Yes |
| B2B / white-label API | No | No | Yes | No | Yes |
| DeFi-native multi-protocol | Yes | Partial | No (CeFi) | Yes (Morpho only) | Yes |
| Agent / MCP tooling | No | No | No | No | Yes |

DeFi Saver has the execution layer but serves retail. Sentora has institutional framing but uses pooled single-protocol vaults. Arcus has B2B API but runs CeFi. The intersection is empty.

## Product Tiers

| Tier | Who Operates | Who Custodies | Target |
|---|---|---|---|
| **LISA** | Client signs | Client's custodian | Institutions with tokenised BTC wanting self-service lending |
| **MLISA** | Syenite operates | Client's custodian | Institutions wanting managed lending without giving up custody |
| **ML** | Syenite operates | Syenite's custodian | Institutions wanting full-service managed lending |

All tiers share the same vault infrastructure. Differences are signing authority and custody — not code.

## Revenue Model

Interest spread. Syenite captures the delta between protocol rates and client rates — through rebalancing alpha, liquidation protection value, and routing optimization. No AUC fees, no stacked charges. Institutions can use the direct path to protocols or the managed path through Syenite. Syenite only earns when it creates value.

## Distribution Channels

1. **AC Smart Accounts** — whitelisted adaptor on the Threshold institutional UI. tBTC minted via Account Control flows through Syenite's managed lending layer. Primary distribution for institutional BTC.
2. **MCP Lending Server** — the canonical tool interface for AI agents interacting with on-chain lending. Free read tools (rates, monitoring, risk) drive developer adoption; paid execution tools (position open, unwind, rebalance) generate vault activity. Parallel primary channel.
3. **Direct Platform** — institutions use Syenite vaults directly via the Syenite dapp (LISA/MLISA). Any BTC wrapper.
4. **B2B Infra / White-Label** — lending desks and platforms integrate vault API + risk framework. Phase 9+.

## Build Strategy

Execution layer: fork of DeFi Saver v3 (MIT, $299M automated assets, battle-tested across 6 chains).
Vault isolation: Safe smart accounts + Zodiac Roles Modifier.
Custom code: ~500 LOC (VaultFactory, WithdrawalGuard, RiskParamRegistry, VaultConfigurator).
Audit: delta only (~$30-50K).

## Project Structure

```
syenite/
├── docs/
│   ├── planning/         # Build plan, milestones, phasing
│   ├── architecture/     # Product architecture, vault design, system layers
│   ├── research/         # Position management, protocol analysis, MCP landscape
│   ├── commercial/       # Revenue model, market segments
│   └── competitive/      # Competitive landscape, market map
├── contracts/            # Solidity (when build starts)
├── keeper/               # Keeper agent infrastructure
├── mcp/                  # MCP lending server (parallel build track)
└── frontend/             # Minimal UI
```

## Status

Pre-build. Documentation, planning, and research complete. MCP lending server and vault contracts are parallel build tracks.
