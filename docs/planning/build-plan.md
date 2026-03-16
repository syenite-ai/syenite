# Syenite — Build Plan

**Status:** Active planning
**Model:** Solo founder + AI agents. No external hires until revenue funds them.
**Capital:** $50-100K bootstrap. No VC.

---

## Phase 0: Development Environment (Week 1)

### Objective
Set up the build environment, fork DeFi Saver, verify compilation and deployment on a local mainnet fork.

### Deliverables
- [ ] Fork DeFi Saver v3 contracts repo
- [ ] Strip to required protocol connectors: **Aave v3** and **Morpho Blue**
- [ ] Remove unused protocol connectors (Liquity, CurveUSD, Spark, Euler, etc.) to reduce audit surface
- [ ] Set up Foundry project with mainnet fork testing
- [ ] Verify: can deploy DeFi Saver Recipe engine + retained Actions on local fork
- [ ] Verify: can execute a basic Aave v3 deposit → borrow recipe on fork using wBTC/tBTC as collateral
- [ ] Document retained vs. removed components

### Test Criteria
- `forge test` passes on local mainnet fork
- Can execute deposit-borrow recipe for wBTC → USDC on Aave v3 via RecipeExecutor
- Can execute deposit-borrow recipe for wBTC → USDC on Morpho Blue via RecipeExecutor

### Dependencies
None. This is the starting point.

### Estimated Effort
5-7 days with AI-assisted development.

---

## Phase 1: Core Vault Contracts (Week 2-3)

### Objective
Build the per-client vault isolation layer on Safe + Zodiac. Deploy the four custom contracts that sit on top of the execution layer.

### Deliverables
- [ ] **VaultFactory** (~100 LOC) — deploys Safe proxy + enables Zodiac Roles module + configures permissions + sets Guard in a single batched transaction. Deterministic addresses via CREATE2.
- [ ] **WithdrawalGuard** (~150 LOC) — Safe Guard that validates every outgoing transaction: if value or tokens leave the vault, recipient must be the client's registered return address or an approved protocol contract.
- [ ] **RiskParamRegistry** (~150 LOC) — global or per-vault risk parameter store. Max LTV per protocol, min pool liquidity threshold, velocity limits. Zodiac Roles permissions reference this.
- [ ] **VaultConfigurator** (~100 LOC) — admin contract for protocol allowlist updates, risk param changes, operator authority management. Timelocked or multisig-gated.
- [ ] Integration tests: VaultFactory deploys vault → Guard prevents unauthorized withdrawal → Roles module allows whitelisted protocol interactions → Risk params enforced
- [ ] Gas benchmarks for vault deployment (target: <$25 at 10 gwei)

### Test Criteria
- Deploy a vault via VaultFactory on local fork
- Deposit wBTC into vault
- Execute Aave v3 deposit-borrow recipe FROM the vault via Safe module → succeeds
- Attempt withdrawal to non-registered address → reverts (Guard)
- Attempt interaction with non-whitelisted protocol → reverts (Roles)
- Attempt to exceed max LTV from RiskParamRegistry → reverts

### Dependencies
Phase 0 (DeFi Saver fork compiles and executes)

### Estimated Effort
7-10 days with AI-assisted development.

---

## Phase 2: Auto-Unwind (Week 3-4)

### Objective
Build the liquidation protection recipes and trigger system. This is the core product — everything else is packaging.

### Deliverables
- [ ] **CLOSE_FULL recipe** — flash borrow stablecoin → repay all debt → withdraw all collateral → swap collateral for stablecoin → repay flash loan → return remainder to client's registered address. Single atomic transaction.
- [ ] **DELEVERAGE_STEP recipe** — same pattern but partial. Reduce LTV by X% (configurable). Used when full close is unnecessary.
- [ ] **Health factor trigger** — on-chain condition check (Aave health factor or Morpho LTV) that activates recipe execution when threshold is breached. Configurable per vault.
- [ ] **Trigger registration** — per-vault trigger configuration stored on-chain (hashed) with full config emitted in events. Mirrors DeFi Saver subscription model.
- [ ] Simulation framework — fork current mainnet state, manipulate oracle price, verify auto-unwind fires correctly and returns collateral to client.
- [ ] Edge case testing: auto-unwind when gas is 200+ gwei, when pool liquidity is thin, when multiple vaults trigger simultaneously.

### Test Criteria
- On mainnet fork: create vault with wBTC collateral on Aave v3, borrow USDC at 60% LTV
- Set auto-unwind trigger at 75% LTV
- Manipulate oracle price to push LTV to 76%
- Keeper detects → simulates CLOSE_FULL → executes
- Verify: debt is zero, collateral (minus swap cost + flash loan fee) returned to client address
- Verify: cost to client < 1% of position (vs. 5-10% Aave liquidation penalty)
- Same test with DELEVERAGE_STEP — verify LTV reduced to target, position remains open

### Dependencies
Phase 0 (execution layer) + Phase 1 (vault contracts)

### Estimated Effort
7-10 days. This is the most complex engineering phase.

---

## Phase 3: Keeper Agent (Week 4-5)

### Objective
Build the autonomous agent that monitors vault health and executes protective actions.

### Deliverables
- [ ] **Vault monitor agent** — polls all active vaults at configurable frequency (default: every block for critical, every 30s for normal). Calculates real-time LTV, health factor, distance to liquidation, distance to auto-unwind trigger.
- [ ] **Simulation engine** — before submitting any transaction, simulates on forked state. Validates: transaction succeeds, cost is within bounds, slippage is acceptable, output meets minimum.
- [ ] **Execution engine** — submits transactions via standard RPC or private relay (Flashbots Protect / MEV Blocker) for critical unwind flows. Handles gas estimation, nonce management, retry logic.
- [ ] **Alert system** — notifications when vaults approach trigger thresholds (email/webhook/Telegram initially).
- [ ] **Rate scanner** — monitors lending rates across Aave v3 and Morpho Blue for BTC collateral markets. Logs rate history. Identifies rebalancing opportunities (used in Phase 5).
- [ ] Multi-vault stress test: 10+ vaults, simultaneous price drop, verify all auto-unwinds execute within acceptable timeframe.

### Test Criteria
- Keeper agent starts, discovers all active vaults, begins monitoring
- Price drop on fork triggers auto-unwind for 3 vaults simultaneously
- All 3 execute successfully within 2 blocks of trigger condition
- Agent logs show: detection → simulation → submission → confirmation for each
- Failed simulation (e.g., insufficient liquidity) triggers alert instead of blind submission

### Dependencies
Phase 2 (recipes and triggers exist)

### Estimated Effort
5-7 days. Largely a TypeScript/agent engineering task.

---

## Phase 4: Audit (Week 5-8)

### Objective
Get the ~500 LOC of custom contracts audited. This is the critical path to mainnet.

### Deliverables
- [ ] Audit RFP sent to 2-3 firms (Spearbit, Trail of Bits, Code4rena contest)
- [ ] Audit scope document: VaultFactory, WithdrawalGuard, RiskParamRegistry, VaultConfigurator + integration with Safe/Zodiac
- [ ] Respond to audit findings, fix critical/high issues
- [ ] Final audit report

### Timeline
- Submit RFP: end of Week 3 (overlap with Phase 2 build)
- Audit starts: Week 5 (after Phase 2 deliverables are frozen)
- Audit duration: 2-3 weeks for ~500 LOC scope
- Fixes + re-review: 1 week
- Clear to deploy: Week 8

### Cost
$30-50K depending on firm and scope.

### What Happens During Audit Wait
- Build keeper agent (Phase 3)
- Build minimal frontend (Phase 5)
- Build MCP server (Phase 6)
- Testnet deployment and manual testing

### Dependencies
Phase 1 + Phase 2 contracts frozen for audit

---

## Phase 5: Minimal Frontend + Mainnet (Week 6-9)

### Objective
Ship a functional (not beautiful) frontend. Deploy on mainnet. First positions.

### Deliverables
- [ ] **Frontend MVP** — Next.js app. Connect wallet (WalletConnect/RainbowKit). Create vault. Deposit collateral. Borrow stablecoin. Set auto-unwind threshold. Dashboard: position health, LTV, rate, distance to liquidation, keeper status.
- [ ] **Mainnet deployment** — deploy all contracts after audit clears. Verify on Etherscan.
- [ ] **Own capital deployment** — deposit personal funds. Run for 2 weeks minimum before opening to others.
- [ ] **Documentation** — user guide, risk disclosures, terms of use.
- [ ] **Basic analytics** — track vault creation, AUC, auto-unwind events, revenue.

### Test Criteria
- End-to-end on mainnet: create vault → deposit wBTC → borrow USDC → auto-unwind triggers on real price movement → collateral returned
- Frontend displays correct position data, updates in real-time
- Keeper agent operates continuously on mainnet for 7+ days without intervention

### Dependencies
Phase 4 (audit complete) for mainnet deployment. Frontend can be built during audit.

### Estimated Effort
Frontend: 5-7 days. Mainnet deployment: 1-2 days. Total phase including testing: 2-3 weeks.

### Revenue
First revenue from auto-unwind events and protection premium on live positions.

---

## MCP Track: Lending Server (Parallel — Starts Week 1)

The MCP lending server is a parallel build track, not a Phase 6 afterthought. The free tier (read-only tools) ships before vaults are on mainnet to capture developer mindshare. The paid tier (execution tools) ships alongside vault contracts.

**Why parallel:** The DeFi MCP niche has ~27 servers, zero targeting institutional lending. 85M+ weekly MCP SDK downloads, all major agent frameworks (CrewAI, LangChain, OpenAI Agents SDK) support MCP natively. First mover captures the category. The free tier is low-cost to build and run; the downside of being early is bounded. See `docs/research/mcp-distribution-landscape.md`.

### MCP Phase A: Free Tier — Read Tools (Week 1-4, parallel with Phase 0-1)

#### Objective
Ship the free read-only MCP tools that make Syenite the best DeFi lending data source for agents. This is the adoption layer — agent developers integrate because the tools are genuinely useful, not because they're a funnel.

#### Deliverables
- [ ] **MCP server skeleton** — remote HTTP transport (streamable HTTP, not stdio). Hosted service, zero local installation.
- [ ] `lending.rates.query` — real-time rates across Aave v3 + Morpho Blue for BTC collateral pairs. Structured output optimized for LLM consumption.
- [ ] `lending.risk.assess` — risk framework output for a proposed position: recommended LTV, liquidity assessment, wrapper risk score, liquidation buffer.
- [ ] `lending.position.monitor` — current LTV, health factor, rate, distance to liquidation, distance to auto-unwind trigger. Works with any existing Aave/Morpho position (not just Syenite vaults).
- [ ] `lending.market.overview` — aggregate view of BTC lending markets: TVL, utilization, rate history, pool liquidity by protocol.
- [ ] **npm package** — published as `@syenite/mcp-lending` with proper MCP metadata.
- [ ] **Multi-directory listing** — official MCP registry, Smithery, Glama, mcp.so, GitHub.
- [ ] **`.well-known/mcp.json`** on syenite domain.
- [ ] **Documentation** — tool descriptions, examples, integration guide. Written for AI model consumption (gets into training data).
- [ ] **Tutorial** — "Build a DeFi lending agent in 30 minutes" using Syenite MCP tools.

#### Test Criteria
- Claude/ChatGPT/Cursor agent can connect to the hosted MCP server and call `lending.rates.query`
- Agent receives structured rate data across Aave v3 + Morpho Blue
- Agent can call `lending.risk.assess` for a proposed BTC lending position and receive actionable risk output
- Server listed in at least 3 MCP directories
- Tutorial is published and indexed

#### Dependencies
None. Rate data and risk assessment can be built against live protocol data without Syenite vault contracts.

#### Estimated Effort
5-7 days for core tools + 2-3 days for distribution/docs.

### MCP Phase B: Paid Tier — Execution Tools (Week 4-8, parallel with Phase 2-3)

#### Objective
Add execution tools that create and manage Syenite vaults. This converts free-tier agent developers into vault users. Revenue flows from vault infrastructure (interest spreads), not MCP tool fees.

#### Deliverables
- [ ] `lending.vault.create` — deploy per-agent isolated vault (Safe proxy via VaultFactory). Returns vault address and configuration.
- [ ] `lending.position.open` — atomic vault creation + deposit + borrow with auto-unwind configured. Single MCP call = full position.
- [ ] `lending.position.adjust` — add/remove collateral, repay partial debt.
- [ ] `lending.position.unwind` — trigger CLOSE_FULL or DELEVERAGE_STEP.
- [ ] `lending.position.rebalance` — migrate position to better-rate protocol (post Phase 7).
- [ ] `lending.report.generate` — position history, P&L, risk events.
- [ ] **Auth + metering** — API key auth for execution tools. Usage tracking per agent/vault.
- [ ] **LISA agent mode** — agent's EOA signs via MCP tool calls. Vault enforces risk guardrails.
- [ ] **MLISA agent mode** — agent owner sets preferences via MCP. Syenite keepers execute within preferences.
- [ ] **Error handling for agents** — LLM-native error messages. Structured failure responses that agents can reason about and retry.

#### Test Criteria
- Agent can call `lending.position.open` on testnet and create a live vault + position
- Agent attempts to exceed max LTV → structured error explaining the constraint
- MLISA mode: agent sets preferences, keeper executes, agent monitors via `lending.position.monitor`
- Auth prevents unauthorized execution

#### Dependencies
Phase 1 (vault contracts) for vault.create. Phase 2 (auto-unwind) for position.unwind. Can ship incrementally as vault features land.

#### Estimated Effort
7-10 days for execution tools + auth + agent mode support.

### MCP Phase C: Distribution Push (Week 6-10)

#### Objective
One marquee integration with a major agent framework. Content push for AI model training data inclusion.

#### Deliverables
- [ ] **Agent framework integration** — target one of: CrewAI native integration, LangChain adapter, OpenAI Agents SDK example. One marquee partnership beats broad listing.
- [ ] **Claude Desktop** verified extension application.
- [ ] **GitHub MCP Registry** submission for VS Code one-click install.
- [ ] **Content campaign** — blog posts, tutorials, documentation optimized for AI crawling and training data inclusion.
- [ ] **Example agents** — open source reference implementations: "BTC lending optimizer agent", "portfolio rebalancing agent", "liquidation protection agent".

#### Dependencies
MCP Phase A (free tier live).

#### Estimated Effort
5-7 days for integration + content. Ongoing for developer relations.

---

## Phase 6: [Merged into MCP Track above]

*The MCP lending server is now a parallel build track starting Week 1, not Phase 6. See MCP Track above.*

---

---

## Phase 7: Cross-Protocol Rebalancing (Month 3-4)

### Objective
Add Loan Shifter functionality — migrate positions between protocols when rate differentials justify the gas cost.

### Deliverables
- [ ] **MIGRATE recipe** — repay debt on Protocol A → withdraw collateral → deposit on Protocol B → borrow on Protocol B. Atomic via flash loan.
- [ ] **Rate differential trigger** — fires when the rate delta between protocols exceeds a threshold for a sustained period (configurable per vault).
- [ ] **Gas-aware decision engine** — migration only executes when net benefit (rate improvement × expected duration) exceeds gas cost + slippage. The keeper agent evaluates this.
- [ ] **Performance fee capture** — when a rebalancing event improves the client's rate, Syenite takes 15-20% of the incremental yield for the period the position remains at the better rate.
- [ ] MCP server update: `lending.position.rebalance` tool

### Test Criteria
- On mainnet fork: vault with wBTC on Aave at 3.1% borrow rate
- Morpho rate drops to 2.0% for the same pair
- Rate scanner detects differential. Keeper simulates migration. Gas + slippage < rate benefit.
- Keeper executes MIGRATE. Position is now on Morpho at 2.0%.
- Client's effective cost reduced by 110bp. Syenite captures 15-20% of the improvement.

### Dependencies
Phase 5 (mainnet live, positions exist to rebalance)

### Estimated Effort
5-7 days for recipe + trigger + fee capture.

### Revenue
Performance fee on rebalancing alpha. Pure upside capture — only earn when client earns more.

---

## Phase 8: MLISA Operator Model (Month 5-7)

### Objective
Add managed vault tier where Syenite operates with discretionary authority.

### Deliverables
- [ ] **Operator authority module** — Zodiac Roles configuration that grants Syenite's operator key permission to execute lending operations (deposit, borrow, repay, rebalance) but NOT withdraw to arbitrary addresses.
- [ ] **MPC signing integration** — Fireblocks or Fordefi for operator key management. Policy engine enforces whitelisted protocols, velocity limits, max position sizes.
- [ ] **Strategy automation** — keeper agent operates MLISA vaults autonomously within coded risk parameters. Selects protocol, sets LTV, manages margin, rebalances.
- [ ] **Client dashboard** — read-only view for MLISA clients. Shows all operator actions, current position, risk metrics.
- [ ] **Regulatory assessment** — determine if VASP registration required for operator model in target jurisdiction.

### Test Criteria
- MLISA vault deployed on mainnet. Syenite operator executes lending operations.
- Client retains withdrawal key — can exit at any time by calling withdrawal directly.
- Operator attempts unauthorized withdrawal → reverts (Guard + Roles).
- Keeper agent manages position through a volatile period — adjusts LTV, triggers rebalancing, avoids liquidation.

### Revenue Gate
Only launch MLISA when LISA revenue covers the incremental cost: ~$50K/yr MPC signing + potential VASP (~$110-160K/yr). Threshold: ~$200K+ annual LISA revenue.

### Dependencies
Phase 5 (mainnet LISA proven) + Phase 7 (rebalancing operational)

---

## Phase 9: B2B API + White-Label (Month 8-12)

### Objective
Package vault infrastructure as a B2B product for lending desks and platforms.

### Deliverables
- [ ] **Vault Factory API** — REST/GraphQL API for programmatic vault deployment, configuration, monitoring.
- [ ] **Risk Framework API** — expose risk parameter recommendations as a service. Per-collateral LTV calibration, liquidation buffer recommendations, pool liquidity assessments.
- [ ] **White-label frontend** — customisable UI components that platforms can embed.
- [ ] **Documentation + developer portal** — API docs, integration guides, sandbox environment.
- [ ] **First B2B integration** — one lending desk or platform using Syenite infrastructure.

### Revenue
SaaS licensing + usage-based fees on vault activity (bp on AUC managed through API).

### Dependencies
Phase 5+ (proven mainnet operations with track record)

---

## Capital Requirements

| Phase | Cost | Cumulative |
|---|---|---|
| Phase 0-3 (build) | $0 (your time + AI tools) | $0 |
| Phase 4 (audit) | $30-50K | $30-50K |
| Phase 5 (mainnet) | $5-10K (legal, infra, gas) | $35-60K |
| Phase 6 (MCP) | $0 (built during audit wait) | $35-60K |
| Phase 7 (rebalancing) | $0 (incremental on existing infra) | $35-60K |
| Phase 8 (MLISA) | Funded from revenue | — |
| Phase 9 (B2B) | Funded from revenue | — |

**Total external capital: $35-60K.** Everything from Phase 8 onward is funded from product revenue.

## Monthly Operating Costs (Post-Launch)

| Item | Cost/mo |
|---|---|
| AI tools (Cursor, Claude API, agents) | $300-500 |
| Hosting (frontend + backend) | $200-500 |
| RPC provider | $200-400 |
| Indexer / subgraph | $100-300 |
| Keeper server (multi-region) | $100-300 |
| Keeper gas costs (variable) | $500-2,000 |
| **Total** | **$1,400-4,000** |

Break-even on operating costs at ~$15-20M vault AUC.

---

## Revenue Milestones

| AUC | Annual Revenue (LISA) | Monthly | Status |
|---|---|---|---|
| $10M | ~$50-100K | ~$4-8K | Covers operating costs |
| $25M | ~$125-250K | ~$10-21K | Comfortable profit |
| $50M | ~$250-500K | ~$21-42K | Funds MLISA launch |
| $100M | ~$500K-1M | ~$42-83K | Funds B2B development |
| $250M | ~$1.25-2.5M | ~$104-208K | Consider raising from revenue position |

Revenue assumes value-based pricing: 25-50bp protection premium + 5-10bp routing spread + performance fee on rebalancing alpha + event fees on auto-unwind.

---

## Decision Points

| Milestone | Decision |
|---|---|
| Phase 4 complete (audit clear) | Deploy on mainnet. Commit capital. |
| $50M LISA AUC | Launch MLISA? Evaluate regulatory requirements. |
| First B2B inbound inquiry | Prioritise B2B API development? |
| $500K+ annual revenue | Raise seed from revenue position? Hire? Scale? |
| DeFi Saver announces institutional product | Accelerate or pivot — assess competitive response. |
| Sentora adds multi-protocol + auto-unwind | Direct competitor emerged — evaluate differentiation. |
