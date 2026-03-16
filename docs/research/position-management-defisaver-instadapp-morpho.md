# Research Memo — Onchain Lending Position Management (Flash Loans, Self-Liquidations)
### DeFi Saver / Instadapp / Morpho — LISA / MLISA implications

**Date:** 2026-03-03  
**Status:** Internal — supports LISA/MLISA Position Management (Layer 2) build decisions  

**Verdict:** **BUILD core Position Management in tPrime vaults**, **adopt MIT patterns/code from DeFi Saver where useful**, integrate **Morpho as a venue**, and treat **Morpho Blue code reuse as licensing-constrained** (GPL/BSL). Use **Instadapp** primarily as design reference + optional partnership surface; avoid code reuse where licensing is unclear.

**Confidence:** Medium (strong evidence on DeFi Saver + Morpho; mixed/partial on Instadapp licensing surfaces).

---

## 1. Research Question (Decision-Driven)

**Question (falsifiable):**  
How do DeFi Saver, Instadapp, and Morpho enable **onchain lending position management** (especially **flash-loan-powered adjustments** and **self-liquidation / close-out** flows), and where should tPrime **adopt / partner / license / build** these capabilities to accelerate **LISA (client-signed)** and **MLISA (tPrime-operated)**?

**Decision it informs:**  
What to ship in the LISA/MLISA Position Management layer (Layer 2) and what to reuse vs rebuild, given:

- **LISA**: client signs transactions; tPrime provides vault guardrails + opt-in auto-unwind.  
- **MLISA**: tPrime has operator authority, but vault constrains withdrawals to client.

**Time horizon:** MVP (0–3 months) vs moat (3–12 months).

---

## 2. Definitions (for consistent language)

**Flash loan (onchain):** Uncollateralized loan executed within **one transaction**; must be repaid (plus fee) **before transaction end** or the transaction reverts.

**Self-liquidation / assisted close-out:** User (or automation on their behalf) **preemptively closes or reduces** a borrow position *before* protocol liquidation, typically by atomically:
1) borrowing temporarily (often a flash loan),  
2) repaying debt,  
3) withdrawing collateral,  
4) swapping collateral → repayment asset,  
5) repaying flash loan, and optionally returning residual collateral to the user.

**Why it matters:** It can avoid protocol liquidation penalties and allows the position owner (or operator) to control routing/slippage/MEV exposure.

---

## 3. Evidence Map (high-signal findings)

| Finding | Entity | Source | Date / Freshness | Evidence Quality |
|---|---|---|---|---|
| “Close … unwinds your position in one transaction … utilizing a flash loan to clear all of your debt using the collateral from your position” | DeFi Saver | https://help.defisaver.com/protocols/aave/liquidations-on-aave | Live docs | High |
| Aave Automation requirements: position must be on Smart Wallet; minimum debt requirement (e.g., $30k mainnet per doc) | DeFi Saver | https://help.defisaver.com/protocols/aave/how-does-aave-automation-work | Live docs | High |
| Automation architecture: modular **Actions → Recipes → Strategies**, with tight bot permissions (immutable `ProxyAuth` can only call `RecipeExecutor.executeRecipeFromStrategy`) | DeFi Saver | https://blog.defisaver.com/automated-strategies-technical-overview/ | (Evergreen technical overview) | High |
| DeFi Saver contracts repo `defisaver-v3-contracts` is **MIT** | DeFi Saver | https://raw.githubusercontent.com/defisaver/defisaver-v3-contracts/main/LICENSE | Current | High |
| Morpho TVL and activity: ~$9.349b TVL; Q1 2026 fees line-item shown | Morpho | https://preview.dl.llama.fi/protocol/morpho?borrowed_tvl=true | Live dashboard | High |
| Morpho Blue license is **GPL v2+ OR Business Source License** (choice) | Morpho | https://raw.githubusercontent.com/morpho-org/morpho-blue/main/LICENSE | Current | High |
| Instadapp DSA design: smart accounts + connectors + delegated permissions; “spells” can compose multi-protocol actions incl. flash liquidity | Instadapp | https://guides.instadapp.io/dive-deeper/defi-smart-accounts | Live docs | High |
| Instadapp Flashloan Aggregator: multi-provider routing; single-tx flow; enumerated routes by chain | Instadapp | https://docs.instadapp.io/flashloan/docs | Live docs | High |
| Instadapp (legacy DSA) current TVL is very low on DefiLlama | Instadapp | https://preview.dl.llama.fi/protocol/instadapp | Live dashboard | High |
| Avocado narrative: USDC gas fees + 20% upcharge; integrator revenue share claim | Instadapp (Avocado) | https://thedefiant.io/news/defi/instadapp-avocado-multi-network-wallet | (Article; check date on page if needed) | Medium |

---

## 4. Product Lens — What “Position Management” means for LISA vs MLISA

### LISA (client-signed)

**Goal:** Provide a vault + UI that makes multi-step position management safe and “one-click,” while staying non-discretionary.

**Best-fit primitives:**
- **One-tx close / deleverage** (flash-loan-powered) for liquidation avoidance (“self-liquidation”).
- **One-tx migrate / refinance** across venues (Aave ↔ Morpho ↔ Compound) when rate differentials justify.
- **Opt-in triggers**: user configures thresholds (LTV / price / safety ratio) that can auto-unwind.

**Constraint:** User signs; automation must be either:
- purely onchain and pre-authorized (e.g., Safe modules / permissioned executors), or
- configured so that the vault can execute constrained actions without discretionary branching.

### MLISA (tPrime-operated)

**Goal:** tPrime can act as operator with discretionary authority but cannot withdraw to arbitrary addresses (vault-enforced).

**Best-fit primitives:**
- Keepers/bots that execute **predefined strategy classes** within strict risk limits.
- Policy-driven execution (whitelists, slippage bounds, liquidity checks, per-client / per-vault velocity limits).
- Strong auditability (strategy configs, triggers fired, simulation results, execution receipts).

---

## 5. Competitive Teardown (through position-management lens)

### DeFi Saver (incl. “Summer.fi Pro migration” context)

**What they clearly have (from primary sources):**
- “Close” (flash-loan unwind) and “Repay using collateral” patterns for Aave positions.  
  Source: https://help.defisaver.com/protocols/aave/liquidations-on-aave
- Automation: non-custodial strategy triggers for liquidation protection and leverage management.  
  Sources: https://help.defisaver.com/features/automation and Aave automation doc above.
- A modular onchain execution model that is directly applicable to building safe automated execution: Actions/Recipes/Strategies + restricted auth path.  
  Source: https://blog.defisaver.com/automated-strategies-technical-overview/

**Why this matters for tPrime:**
- DFS is effectively a “reference implementation” for L2 Position Management patterns that are battle-tested.
- Their *permissioning model* is the most portable piece: tight, constrained execution by bots without giving bots general spend authority.

**Licensing posture:**
- Core contracts appear permissive (MIT) in the primary repo license.  
  Source: https://raw.githubusercontent.com/defisaver/defisaver-v3-contracts/main/LICENSE
- Commercial/ToS terms for *using DFS as a hosted automation provider* are not established here; treat as partnership/BD work, not an engineering assumption.

### Instadapp (DSA + Flashloan Aggregator; Avocado as AA infra)

**DSA (legacy) relevant concepts:**
- DSAs are programmable accounts with connectors and delegated permissions down to connector-level.  
  Source: https://guides.instadapp.io/dive-deeper/defi-smart-accounts
- “Spells” model is conceptually similar to DFS recipes: compose multi-step multi-protocol transactions in one “cast”.

**Flashloan Aggregator:**
- Multi-route flash liquidity via multiple providers and advanced routes, with per-chain route availability.  
  Source: https://docs.instadapp.io/flashloan/docs

**Avocado:**
- Separately, Avocado is positioned as account-abstraction wallet infra with USDC gas and broadcaster network (helps UX; not obviously core to tPrime vaults).  
  Narrative source: https://thedefiant.io/news/defi/instadapp-avocado-multi-network-wallet  
  Primary implementation hints: Avocado docs and contracts overview: https://docs.avocado.instadapp.io/contracts/contracts-overview.html

**Adoption signal (caveat):**
- DefiLlama shows low TVL for “Instadapp (INST)” at time of reading. This likely reflects legacy DSA tracking rather than Avocado usage, but it’s still a weak adoption proxy for “DSA as an active position-management hub.”  
  Source: https://preview.dl.llama.fi/protocol/instadapp

**Licensing posture (what we can say with evidence):**
- GitHub repo metadata indicates `dsa-contracts` and `avocado-sdk` have **no declared license** (`license: null`).  
  Sources: https://api.github.com/repos/Instadapp/dsa-contracts and https://api.github.com/repos/Instadapp/avocado-sdk
- `avocado-sdk` package manifest (raw) also does not include a `license` field.  
  Source: https://raw.githubusercontent.com/Instadapp/avocado-sdk/master/package.json
- `avocado-contracts-public` `package.json` declares **MIT**.  
  Source: https://raw.githubusercontent.com/Instadapp/avocado-contracts-public/master/package.json

**Implication:** Treat Instadapp as:
- **Design reference** (DSA concepts, flashloan routing patterns), and
- **Partnership candidate** (if they offer clear commercial terms / SDK license), but
- **Do not copy code** from repos without explicit license clarity.

### Morpho (Morpho Blue as venue; position-management mostly external)

**What Morpho is (for this memo):**
- A major lending venue with large TVL and activity (DefiLlama metrics show it is worth first-class integration).  
  Source: https://preview.dl.llama.fi/protocol/morpho?borrowed_tvl=true

**Key point through this lens:**
- Morpho provides lending primitives; “position management” is usually delivered by external layers (frontends, vault curators, automation systems like DFS/Summer).

**Licensing posture (critical):**
- Morpho Blue code is offered under **GPL v2+ OR Business Source License**.  
  Source: https://raw.githubusercontent.com/morpho-org/morpho-blue/main/LICENSE

**Implication:** Integrate Morpho as a venue via interaction, but treat Morpho Blue code reuse as constrained unless we are prepared to comply with GPL obligations or negotiate a commercial arrangement under BSL terms.

---

## 6. Adopt / Partner / Build Matrix (tPrime perspective)

| Capability | LISA fit | MLISA fit | Fastest path | IP / licensing risk | Recommendation |
|---|---|---|---|---|---|
| One-tx close (“self-liquidation”) via flash loan | High | High | Build using proven recipe patterns | Low if built; low if DFS MIT code reused | **Build** (use DFS patterns) |
| One-tx migrate/refinance across venues | High | High | Build; optionally borrow DFS/DSA “recipe” mental model | Medium (routing/MEV complexity) | **Build**, ship 1–2 venues first |
| Strategy engine (Triggers + Recipes) | Medium–High | High | Build minimal core; adopt DFS auth model | Low if own code; low if DFS MIT snippets reused | **Build** (in-vault), mirror DFS constraints |
| Keeper network / execution bots | Low–Medium (if LISA opts in) | High | Build in-house keepers + monitoring | Operational risk > licensing risk | **Build** (tPrime-owned) |
| Smart account / AA wallet infra (Avocado-like) | Medium | Medium | Partner/integrate (optional) | Licensing unclear + UX dependency | **Defer** (not core to vault PM) |
| Morpho core integration | High | High | Integrate as venue | Low (usage) / High (code reuse) | **Integrate venue; avoid code reuse** |

---

## 7. Build Spec — tPrime Position Management Engine (LISA / MLISA)

This is an implementation-grade spec for “Layer 2 — Position Management” that aligns with the vault constraints in `product-architecture.md` (client-signed LISA; operator-signed MLISA; withdrawals constrained).

### 7.1 Goals and invariants

**Goals:**
- Provide safe, atomic, institution-grade position adjustments across whitelisted lending venues.
- Make liquidation avoidance and refinance/migration *first-class workflows*, not bespoke scripts.
- Maintain tight operator permissions and auditability.

**Non-negotiable invariants:**
- **No arbitrary withdrawals**: vault enforces “withdrawal destinations” (client address only).
- **Whitelisted venues and assets only**: enforced onchain.
- **Deterministic strategy semantics**: strategy configs are hashed + versioned; execution cannot mutate critical params at runtime.
- **MEV-aware execution**: slippage bounds, route validation, and optionally private tx submission for critical unwind flows.

### 7.2 Core primitives (recipes)

Define “recipes” as immutable templates with strict inputs. Minimum set:

1) **CLOSE_FULL**: repay all debt → withdraw all collateral → return collateral (or swap) to client.  
2) **DELEVERAGE_STEP**: repay \(x\) debt using collateral (flash-loan optional) → withdraw \(y\) collateral.  
3) **MIGRATE**: repay venue A → withdraw collateral → supply venue B → borrow venue B.  
4) **DEBT_SWAP**: repay debt asset A (using flash loan + swap) → borrow debt asset B.  
5) **COLLATERAL_SWAP**: swap collateral asset while maintaining target LTV bounds.

### 7.3 Strategy layer (triggers + recipes)

Model: **Trigger(s)** + **Recipe** + **Bounded parameter policy**.

**Triggers (minimum):**
- LTV / Health-factor threshold
- Price threshold (oracle-based)
- Rate differential threshold (refinance signal)
- Time-based check-in (e.g., daily guardrail)

**Policy bounds (examples):**
- Max slippage bps; max price impact; min onchain liquidity
- Max gas cost threshold (or gas cap)
- Max leverage change per step; cooldown windows
- Venue selection whitelist per vault/client

**Storage model recommendation (from DFS pattern):**
- Store **hash** of subscription/config onchain; emit full config in events for retrieval + validation at execution.

### 7.4 Execution authority model (LISA vs MLISA)

**LISA:**
- Client signs transactions.
- For opt-in auto-unwind:
  - Use a Safe module / delegated executor with narrowly scoped permissions (e.g., can only execute StrategyExecutor on this vault).
  - StrategyExecutor enforces that only pre-registered strategies can run, and only within bounds.

**MLISA:**
- tPrime operator key (MPC) triggers executions.
- Same StrategyExecutor constraints apply, but operator signs.
- Vault must hard-enforce “withdrawal to client only” + venue allowlists to prevent operator extraction.

### 7.5 Keeper/automation system (operational)

**Keepers are critical path in stress.** Design for worst-day behavior:
- Multi-region redundancy; multiple broadcaster endpoints.
- Simulation-before-send on forked state for unwind paths (esp. close/migrate).
- Private relay option for liquidation-avoidance flows (configurable by client tier).
- Alerting + fallback modes (if unwind fails, try DELEVERAGE_STEP; if that fails, notify + pause).

### 7.6 Safety and failure-mode requirements (learned from history)

From Maker Black Thursday and DFS postmortem-style lessons:
- Assume **network congestion** and **oracle delays** will occur at the worst possible time.
- Avoid reliance on “next price” unless you can source it robustly; design buffers.
- Use multi-step unwind approaches that can still function when very close to liquidation thresholds.

### 7.7 MVP scope (0–3 months)

**Ship:**
- Venue integrations: **Aave v3 + Morpho Blue** (as venues).  
- Recipes: **CLOSE_FULL** + **DELEVERAGE_STEP** + **MIGRATE** (Aave↔Morpho).  
- Trigger: **LTV threshold** (auto-unwind) + notifications.
- Policy: slippage caps, min liquidity checks, max step size.

**Defer:**
- Debt/collateral swaps (unless required for close path).
- Complex rate-arb signals; multi-venue optimizer.
- Wallet/AA UX layer (Avocado-like).

### 7.8 Moat scope (3–12 months)

- Portfolio-aware risk limits across multiple client vaults (MLISA).
- More venues, but behind strict per-venue risk calibration.
- “Institutional control plane”: audit logs, evidence trails, operator segregation-of-duties, incident playbooks.
- Strategy marketplace is optional; defensibility is in risk/policy + execution reliability, not “more buttons.”

---

## 8. Licensing / Commercial Notes (what we can and cannot reuse)

**Safe to adopt (with evidence):**
- DeFi Saver v3 contracts (MIT).  
  Source: https://raw.githubusercontent.com/defisaver/defisaver-v3-contracts/main/LICENSE
- Instadapp `avocado-contracts-public` indicates MIT in its `package.json`.  
  Source: https://raw.githubusercontent.com/Instadapp/avocado-contracts-public/master/package.json

**Treat as constrained:**
- Morpho Blue code reuse (GPL/BSL dual); treat as “venue integration,” not embedded code.  
  Source: https://raw.githubusercontent.com/morpho-org/morpho-blue/main/LICENSE

**Treat as unknown until verified:**
- Instadapp `dsa-contracts` and `avocado-sdk` (GitHub repo metadata shows license null).  
  Sources: https://api.github.com/repos/Instadapp/dsa-contracts and https://api.github.com/repos/Instadapp/avocado-sdk

---

## 9. Open Questions / Invalidation Triggers

If any of the below is true, the recommendation may flip toward partnership/licensing:

- Morpho offers a **commercial license** pathway (under BSL terms) that cleanly permits embedding/modifying Morpho Blue code in proprietary infra, and it materially accelerates time-to-market.
- Instadapp provides explicit licensing + enterprise terms for `avocado-sdk` or DSA middleware that reduces engineering effort for institution-grade execution (and is compatible with tPrime vault constraints).
- DeFi Saver offers an enterprise-grade “automation as a service” arrangement with strong SLAs + compliance posture that is better than building keepers internally (and doesn’t compromise tPrime defensibility).

---

## Appendix — Primary Sources Used

- tPrime Product Architecture: `deal-intelligence/independent-preferred/product-architecture.md`
- DeFi Saver (Aave liquidations + Close): https://help.defisaver.com/protocols/aave/liquidations-on-aave
- DeFi Saver (Aave automation requirements): https://help.defisaver.com/protocols/aave/how-does-aave-automation-work
- DeFi Saver (technical overview): https://blog.defisaver.com/automated-strategies-technical-overview/
- DeFi Saver license: https://raw.githubusercontent.com/defisaver/defisaver-v3-contracts/main/LICENSE
- Instadapp DSA guide: https://guides.instadapp.io/dive-deeper/defi-smart-accounts
- Instadapp Flashloan Aggregator: https://docs.instadapp.io/flashloan/docs
- Instadapp TVL (legacy tracking): https://preview.dl.llama.fi/protocol/instadapp
- Morpho metrics: https://preview.dl.llama.fi/protocol/morpho?borrowed_tvl=true
- Morpho Blue license: https://raw.githubusercontent.com/morpho-org/morpho-blue/main/LICENSE
- Instadapp repo metadata: https://api.github.com/repos/Instadapp/dsa-contracts and https://api.github.com/repos/Instadapp/avocado-sdk
- Avocado contracts metadata (MIT): https://raw.githubusercontent.com/Instadapp/avocado-contracts-public/master/package.json
- Avocado narrative (USDC gas + upcharge): https://thedefiant.io/news/defi/instadapp-avocado-multi-network-wallet

