# Syenite — Product Architecture

**Adapted from tPrime product architecture. Reframed for ecosystem-agnostic positioning.**

---

## 1. Product Tiers

Syenite operates three product tiers on shared infrastructure. Each tier serves a different client profile, carries a different margin, and sits in a different regulatory zone.

### LISA — Lending Infrastructure as a Service

Self-service lending router and risk-managed vault. The client uses their own wallet, initiates loans, and manages their own position within Syenite's risk guardrails.

**Flow:**

1. Client has tokenised BTC (tBTC, LBTC, cbBTC, wBTC) in their wallet
2. Client creates a Syenite vault (Safe proxy deployed via VaultFactory)
3. Client deposits tokenised BTC into vault
4. Client selects loan parameters via UI: amount, preferred protocol, LTV (within Syenite's max limits)
5. Syenite router identifies best available rate across Aave, Morpho, Compound
6. Client confirms — vault executes atomically: collateral deposit → borrow → stablecoin to client's address
7. Ongoing: client monitors position via dashboard (LTV, rate, liquidation price, keeper status)
8. Auto-unwind (opt-in): vault fires flash-loan unwind at configurable LTV threshold, before protocol liquidation. Saves 5-10% liquidation penalty.
9. Rebalancing (opt-in): when rate differential between protocols exceeds threshold, vault migrates position atomically via Loan Shifter.
10. Unwind: client initiates repayment → vault withdraws collateral → BTC returned to client

**Regulatory zone:** DeFi frontend / tech provider. Client signs all transactions. Same zone as Uniswap, DeFi Saver, 1inch.

### MLISA — Managed LISA

Same vault infrastructure, but Syenite operates with discretionary authority. The client deposits tokenised BTC and receives a managed lending service.

**Flow:**

1. Client deposits tokenised BTC into an MLISA vault
2. Syenite operates the vault: selects protocol, sets LTV, manages margin, rebalances between protocols
3. Client sees dashboard telemetry: current LTV, rate, borrowed amount, margin status, all operator actions
4. Syenite handles all execution decisions — client does not manage the position
5. Vault has the same smart contract constraints as LISA (whitelisted protocols, withdrawal to client only), but Syenite holds operator authority via Zodiac Roles
6. Client can withdraw at any time using their own keys

**Regulatory zone:** Vault operator with discretionary authority. May require VASP registration. Same zone as Morpho vault curators, Yearn strategies.

### ML — Managed Lending

MLISA where Syenite also handles custody and BTC tokenisation. Same vault infrastructure, same execution layer — the difference is upstream (who custodies, who mints) and downstream (white-glove service, bespoke terms).

**Flow:**

1. Institution deposits BTC to Syenite's QC account
2. Syenite mints tokenised BTC (via AC, Lombard, or direct protocol) → destination is Syenite's ML vault
3. Syenite executes lending positions through the vault
4. Syenite manages risk, margin, rebalancing, and client reporting
5. On repayment: Syenite unwinds via vault, redeems BTC, returns to client

**Regulatory zone:** Regulated financial services. Requires lending/custody authorization. Deferred until LISA/MLISA revenue justifies the cost.

### Tier Comparison

| Dimension | LISA | MLISA | ML |
|---|---|---|---|
| Who decides protocol | Client (router recommends) | Syenite | Syenite |
| Who sets LTV | Client (within max) | Syenite | Syenite |
| Who handles margin events | Client responds to alerts | Syenite auto-manages | Syenite auto-manages |
| Who triggers unwind | Client (or opt-in auto) | Syenite (discretionary) | Syenite (discretionary) |
| Who rebalances | Client (opt-in) | Syenite (automatic) | Syenite (automatic) |
| Custody | Client's wallet | Client's wallet | Syenite's QC |
| BTC wrapper | Any (tBTC, LBTC, cbBTC, wBTC) | Any | Syenite mints |
| Revenue model | Protection premium + routing spread + performance fee | Management fee + performance fee | Full lending spread |
| Margin | Medium | High | Highest |
| Scale | Highest | High | Low |
| Regulatory weight | Lightest | Medium | Heaviest |

---

## 2. System Architecture

### Infrastructure Layers

```
Layer 5 — Institutional Service    [MLISA, ML]           ← Syenite builds
  Reporting, compliance, client comms, onboarding, SLA

Layer 4 — Risk Framework           [LISA, MLISA, ML]     ← Syenite builds (Core IP)
  LTV calibration, liquidation buffers, cross-protocol risk,
  position sizing vs pool liquidity, correlation risk

Layer 3 — Position Management      [LISA, MLISA, ML]     ← DeFi Saver fork + Syenite extensions
  Real-time LTV monitoring, margin alerts, liquidation protection
  (flash-loan auto-unwind), rate monitoring, refinancing signals,
  cross-protocol rebalancing via Loan Shifter

Layer 2 — Transaction Execution    [LISA, MLISA, ML]     ← DeFi Saver fork
  Recipe engine: atomic multi-step flows (deposit → borrow,
  repay → withdraw, cross-protocol migration via flash loans).
  Supports Aave, Morpho, Compound.

Layer 1 — Swap/Bridge Routing      [MCP Router]          ← Li.Fi aggregation (LIVE)
  Cross-chain swap and bridge routing via 1inch, 0x, Paraswap,
  and bridge protocols. 30+ chains. Unsigned calldata returned to
  agent for signing. Integrator fee on volume. Primary revenue
  channel for agent-driven DeFi interactions.

Layer 0 — Rate & Yield Aggregation [LISA, MLISA, ML]     ← On-chain data (LIVE)
  Fetch/compare lending rates, yield opportunities across
  supported protocols. Positions SDK for cross-protocol monitoring.
```

### IP Map

| Layer | Defensibility | Source |
|---|---|---|
| L0 — Rate Aggregation | None. Commodity. | DeFi Saver fork |
| L1 — Transaction Execution | Low. Proven, forkable. | DeFi Saver fork (MIT) |
| L2 — Position Management | Medium-High. Operational reliability through stress. | DeFi Saver fork + Syenite keeper agents |
| L3 — Risk Framework | **High. Core IP.** Quantitative models, calibrated live. | Syenite builds (proprietary) |
| L4 — Institutional Service | **High.** Commercial, not technical. | Syenite builds |
| Vault Isolation | Medium-High. Configuration + access control design. | Safe + Zodiac + Syenite custom contracts |
| Client Relationships | **High.** Sticky post-onboarding. | Syenite builds |
| MCP Library Adoption | **Medium-High.** Developer switching costs. | Syenite builds (open core) |

---

## 3. Delivery Modes

### AC Smart Account Adaptor (Primary)
Syenite is a whitelisted adaptor on the Threshold AC Smart Account system. Institutions mint tBTC via Account Control into their Smart Account, then deploy tBTC into Syenite's managed lending layer through the tLabs institutional UI. Revenue: interest spread on managed positions, shared with Threshold DAO via the adaptor rev share model.

**Why this is primary:** AC SAs provide institutional distribution with per-client ACA legal protections, segregated QC custody, and automated onboarding. Syenite adds differentiation to the AC SA offering that passive Morpho vault access can't match — per-client vault isolation, auto-unwind, cross-protocol rebalancing, and real-time position management. Without a managed lending layer, tBTC's SA offering is functionally identical to Lombard's.

### MCP DeFi Router (Primary — Live)
The canonical MCP interface for AI agents interacting with DeFi. Any agent framework (CrewAI, LangChain, OpenAI Agents SDK) can connect via standardised MCP tools. Live at syenite.ai/mcp.

**Data layer** (adoption): `yield.opportunities`, `yield.assess`, `lending.rates.query`, `lending.market.overview`, `lending.position.monitor`, `lending.risk.assess` — read-only tools that make Syenite the best DeFi data source for agents. Free. Drives adoption.

**Execution layer** (revenue): `swap.quote`, `swap.status` — swap and bridge routing across 30+ chains via Li.Fi aggregation (1inch, 0x, Paraswap, bridges). Returns unsigned calldata; agent signs. Revenue via integrator fee on swap/bridge volume. No private keys held.

**Future execution**: `yield.deposit`, `yield.withdraw`, `position.open`, `position.rebalance` — vault management tools that create Syenite vaults. Revenue from vault infrastructure (interest spreads).

**Competitive positioning**: Symbiosis MCP, deBridge MCP, and y0exchange offer swap-only MCP servers. Syenite is the only server combining intelligence (yield data, risk assessment, lending) with execution (swap routing, bridges) in one endpoint. Agents choose one server, not three.

**LISA for agents:** The agent calls MCP tools, reasons about rates and risk, executes swaps, and manages positions — the Syenite vault enforces hard guardrails (max LTV, whitelisted protocols, authorized withdrawals).

**Why agents need this more than humans:** Agents lack instinct, context, and panic buttons. Auto-unwind, vault isolation, and on-chain risk parameter constraints are existentially necessary for agents — hard guardrails that model weights can't override.

Revenue: integrator fees on swap/bridge volume (near-term) + interest spread on vault positions (medium-term).

### Direct Platform (LISA / MLISA)
Institutions use Syenite vaults directly through the Syenite dapp with any BTC wrapper (tBTC, LBTC, cbBTC, wBTC). Revenue: interest spread on managed positions.

### B2B Infra / White-Label (Phase 9+)
Lending desks and platforms integrate Syenite vault infrastructure:
- Vault contracts deployed for their clients
- Risk parameter API
- Execution engine (atomic flows, flash-loan unwind, migration)
- Position monitoring + alerting service
- Reporting layer

Revenue: SaaS licensing + usage-based fees (bp on AUC).

---

## 4. BTC Wrapper Agnosticism

Syenite vaults accept any ERC-20 BTC representation:

| Wrapper | Source | Integration |
|---|---|---|
| tBTC | Threshold Network | Direct. Preferred UI distribution via Threshold institutional UI. |
| LBTC / BTC.b | Lombard | Via smart account whitelist. |
| cbBTC | Coinbase | Direct deposit to vault. |
| wBTC | BitGo | Direct deposit to vault. |
| FBTC | Function | Direct deposit to vault. |

The vault contracts don't care which BTC wrapper is deposited. Risk parameters are calibrated per wrapper (different liquidity profiles, different redemption risk, different peg stability).

---

## 5. Distribution Channels

| Channel | Mechanism | Priority |
|---|---|---|
| **AC Smart Account adaptor** | Whitelisted managed lending layer on tLabs institutional UI. tBTC institutions deploy into Syenite via SA. | **Primary** |
| **MCP lending server** | AI agents discover and integrate via MCP directories, npm, agent frameworks. Free tier drives adoption, paid tier drives vault creation. | **Primary (parallel)** |
| Own dapp | Permissionless. Anyone with tokenised BTC. Any wrapper. | Primary (Phase 5) |
| Lombard smart accounts | Whitelisted vault provider on Lombard SA system. | Secondary (future) |
| Atlas (Anchorage) | Lending protocol integration via collateral management. | Future (Phase 9+) |
| Agent framework partnerships | Default lending tool in CrewAI, LangChain, or OpenAI Agents SDK. | High priority (one marquee integration > broad listing) |
| Protocol grants | Aave, Morpho grants for integration work. | Opportunistic |
| B2B partnerships | Lending desks integrate vault API. | Phase 9+ |

### MCP Distribution Mechanics

The MCP ecosystem has 85M+ weekly npm downloads, 11,800+ servers, and cross-vendor client support (Claude, ChatGPT, Cursor, VS Code, Windsurf, Cline). The DeFi niche within it has ~27 servers, none targeting institutional lending. See `docs/research/mcp-distribution-landscape.md` for the full competitive analysis.

**Distribution playbook:**
1. Free tier ships early (before vaults are on mainnet) — agent developers build against read tools
2. Multi-directory listing: official MCP registry, Smithery, Glama, mcp.so, npm, GitHub
3. One marquee integration with a major agent framework (worth more than all directory listings combined)
4. Content: "Build a DeFi lending agent in 30 minutes" tutorial — optimized for AI model consumption (gets into training data)
5. Remote HTTP transport — hosted service, zero local installation friction
6. `.well-known/mcp.json` on syenite domain for decentralized discovery
