# Syenite — Competitive Landscape

---

## Market Map

### Direct Competitors (institutional BTC DeFi vaults)

**None currently occupy the exact intersection.** The gap: per-client isolated vaults + flash-loan liquidation protection + cross-protocol rebalancing + institutional controls + multi-protocol DeFi-native execution.

### Adjacent Players

#### DeFi Saver
- **What they have:** Auto-unwind, Loan Shifter, Recipe engine, automated strategies. Battle-tested — 1,227 automated transactions in one day during Feb 2026 $5B liquidation event, protecting 467 positions. $299M in automated assets. MIT license.
- **What they don't have:** Per-client vault isolation. Institutional controls. B2B API. Managed service. BTC-specific risk framework.
- **Positioning:** Retail DeFi automation. Individual users managing their own wallets.
- **Threat level:** **High if they pivot to institutional.** They have the execution layer. If they add vault isolation and B2B APIs, they're 6-12 months ahead on execution. Watch closely.
- **Syenite advantage:** Building institutional wrapper from day one. They'd have to retrofit retail infrastructure.

#### Sentora
- **What they have:** Institutional FBTC vault on Aave. Multi-sig workflows, auditable reporting, programmatic execution. Expanding into RLUSD vaults on Morpho.
- **What they don't have:** Per-client isolation (pooled vaults). Flash-loan liquidation protection. Cross-protocol rebalancing. Multi-protocol routing.
- **Positioning:** Institutional DeFi yield strategies. Morpho curator model applied to BTC.
- **Threat level:** **Medium.** Closest in institutional positioning. If they add auto-unwind and multi-protocol, direct competitor.
- **Syenite advantage:** Protocol-agnostic from day one. Per-client isolation vs. pooled.

#### Arcus
- **What they have:** "Lending-as-a-Service" white-label API. Fireblocks MPC custody. Institutional KYB. Up to 11% APY.
- **What they don't have:** DeFi-native execution. Flash-loan mechanics. Cross-protocol rebalancing. They run CeFi — own rates, own custody, own risk.
- **Positioning:** CeFi institutional BTC lending packaged as B2B infra.
- **Threat level:** **Low-medium.** Same B2B angle but wrong stack. Would need to rebuild from scratch to go DeFi-native.
- **Syenite advantage:** DeFi-native. Flash-loan mechanics. Multi-protocol routing. Transparency (on-chain execution).

#### Lygos
- **What they have:** Non-custodial BTC lending via DLCs on Bitcoin L1. Founded by ex-Anchorage/JPMorgan. $100M collateral capacity. Bankruptcy-remote by design.
- **What they don't have:** DeFi protocol access. No yield optimization. No cross-protocol anything. BTC L1 only.
- **Positioning:** BTC-native peer-to-peer lending. Anti-bridge, anti-wrapper.
- **Threat level:** **Low.** Completely different stack and philosophy. Not competing for the same users.

#### Morpho Vaults V2
- **What they have:** Institutional access gates (KYC, token-gated). Flash-loan redemptions. Curated vault model with sophisticated risk management.
- **What they don't have:** Per-client vault isolation (pooled). Flash-loan for position liquidation protection (their flash loans are for vault share redemption). Cross-protocol (Morpho only). Active position management.
- **Positioning:** Permissionless, curated lending markets with institutional-compatible access.
- **Threat level:** **Low as direct competitor. High as venue.** Morpho is where Syenite routes capital, not what Syenite competes with. Morpho curators (Steakhouse, Gauntlet, RE7) are more directly adjacent — but they're pooled vault operators, not per-client infrastructure providers.

### Infrastructure Partners (not competitors)

#### Anchorage Digital (Atlas)
- Does NOT run a proprietary lending desk
- Acts as collateral agent and settlement infra via Atlas
- Facilitates third-party lending protocols (Spark, Mezo, Morpho, Kamino)
- **Opportunity:** Syenite could be an Atlas-integrated lending protocol — Anchorage's institutional sales team distributes access to Syenite vaults
- **Relationship:** Channel partner, not competitor

#### Threshold Network (tBTC / AC Smart Accounts)
- BTC wrapper + smart account infrastructure
- Institutional UI surfaces whitelisted vault providers
- **Opportunity:** Preferred vault provider on Threshold institutional UI. Commercial agreement (rev share on tBTC-originated lending).
- **Relationship:** Integration partner + distribution channel

#### Lombard (LBTC / BTC.b Smart Accounts)
- BTC wrapper + smart account infrastructure
- 5 QC integrations, $1.5B TVL
- **Opportunity:** Whitelisted vault provider on Lombard smart accounts.
- **Relationship:** Integration partner + distribution channel

---

## Capability Matrix

| Capability | DeFi Saver | Sentora | Arcus | Morpho V2 | Lygos | Syenite |
|---|---|---|---|---|---|---|
| Flash-loan auto-unwind | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Cross-protocol rebalancing | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Per-client vault isolation | ✗ | ✗ | ✓ (CeFi) | ✗ | ✓ (DLC) | ✓ |
| Institutional controls | ✗ | Partial | ✓ | Partial | ✗ | ✓ |
| BTC-specific risk framework | ✗ | ✗ | Partial | ✗ | ✗ | ✓ |
| B2B / white-label API | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ (Phase 9) |
| DeFi-native multi-protocol | ✓ | Partial | ✗ | ✓ (Morpho) | ✗ | ✓ |
| Agent / MCP tooling | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (Phase 6) |
| BTC wrapper agnostic | N/A | FBTC only | BTC native | Any ERC-20 | BTC L1 | Any ERC-20 |

---

## Competitive Moat Assessment

| Moat Type | Strength | Notes |
|---|---|---|
| Technology (execution layer) | **Weak.** DeFi Saver fork is MIT. Anyone can replicate. | Time-to-market advantage only. |
| Technology (vault isolation) | **Medium.** Safe + Zodiac is open, but the specific configuration + custom guards are product design. | Forkable in principle but requires risk + operational layer to be useful. |
| Risk framework | **Strong.** Proprietary quant models, calibrated through live operation. Improves with data and time. | Not code to fork — calibration informed by market cycles. |
| Operational reliability | **Strong.** Track record of auto-unwinds during stress. Keeper uptime. | Earned through operation, not purchased. |
| B2B integration depth | **Strong (once established).** Compliance-approved, embedded in client workflows. | High switching costs post-integration. |
| MCP/SDK adoption | **Medium-Strong (if early).** Developer switching costs compound. | First-mover advantage in agent tooling for DeFi lending. |
| Brand / trust | **Weak initially.** No track record. | Builds with successful auto-unwind events and operational history. |

---

## MCP Competitive Landscape (March 2026)

The DeFi MCP niche has ~27 servers on mcp.so. Zero target institutional BTC lending. See `docs/research/mcp-distribution-landscape.md` for the full analysis.

| Competitor | Focus | Threat to Syenite |
|---|---|---|
| **L1.co** | Institutional-grade MCP; Morpho, Aave V3, Pendle | **Medium.** Closest in institutional positioning. General asset management, not BTC-specific. No auto-unwind, no cross-protocol rebalancing. |
| **DeFi Rates MCP** | Lending rates, 14+ protocols, 6 chains | **Low.** Read-only data. No execution. |
| **Hive Intelligence** | Broad DeFi analytics, 250+ tools | **Low.** Wide but shallow. Data aggregation. |
| **Arcadia Finance** | Leveraged concentrated liquidity | **Low.** LP-focused, not lending. 809 weekly npm downloads. |
| **Bastion** | Risk intelligence, 147 tools, 72B model | **Low.** Risk data, not execution. Could be complementary. |

---

## Key Risks

| Risk | Probability | Impact | Mitigant |
|---|---|---|---|
| DeFi Saver launches institutional product or MCP server | Medium | High | Move fast. Ship before they pivot. MCP free tier ships in weeks, not months. |
| Sentora adds multi-protocol + auto-unwind | Medium | Medium | Per-client isolation + BTC-specific risk framework + MCP tooling are differentiators they'd need to build from scratch. |
| L1.co expands into BTC lending specifically | Low-Medium | Medium | Syenite's BTC wrapper awareness, auto-unwind, and AC SA integration are structural advantages L1.co would need to build. |
| Smart contract exploit in vault or execution layer | Low (audited) | Critical | Delta audit on custom code. Battle-tested base (DeFi Saver + Safe). Insurance consideration at scale. |
| Low adoption / can't reach $15M AUC | Medium | High | Three distribution channels (AC SA, MCP, direct). MCP free tier captures developer mindshare at low cost. AC SA provides institutional baseline. |
| Agentic DeFi market doesn't materialize at scale | Medium | Medium | MCP free tier is low-cost to run. Downside is bounded. Institutional (AC SA) and direct channels are not agent-dependent. |
| Regulatory action against DeFi vault operators | Low (LISA) / Medium (MLISA) | High | LISA is non-discretionary (client signs). MLISA deferred until regulatory picture clearer. |
