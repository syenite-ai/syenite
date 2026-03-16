# Syenite — Vault Design Specification

**Technical spec for the per-client vault isolation layer.**

---

## 1. Architecture Overview

Each Syenite vault is a **Safe smart account** (proxy clone) with modular extensions for access control and risk enforcement. The vault holds client collateral, executes DeFi lending operations via DeFi Saver's Recipe engine, and enforces hard guardrails on who can do what.

```
┌─────────────────────────────────────────────┐
│  Syenite Vault (Safe Proxy)                 │
│                                             │
│  Owner: Client (LISA) or Client (MLISA)     │
│                                             │
│  Modules:                                   │
│  ├── Zodiac Roles Modifier                  │
│  │   ├── Protocol allowlist (Aave, Morpho)  │
│  │   ├── Selector allowlist (deposit,       │
│  │   │   borrow, repay, withdraw)           │
│  │   └── Parameter bounds (from Registry)   │
│  │                                          │
│  └── DeFi Saver RecipeExecutor (module)     │
│      └── Scoped to approved Action addrs    │
│                                             │
│  Guard:                                     │
│  └── WithdrawalGuard                        │
│      └── Outgoing value/tokens → only to    │
│          registered return address or        │
│          approved protocol contracts         │
│                                             │
│  Risk Params: (from RiskParamRegistry)      │
│  ├── Max LTV per protocol                   │
│  ├── Min pool liquidity threshold            │
│  ├── Max position size                      │
│  └── Velocity limits                        │
└─────────────────────────────────────────────┘
```

## 2. Custom Contracts (~500 LOC total)

### VaultFactory (~100 LOC)

Wrapper around SafeProxyFactory. Single transaction deploys a fully configured vault:

1. Deploy Safe proxy via `createProxyWithNonce` (deterministic address via CREATE2)
2. Enable Zodiac Roles Modifier as module
3. Configure Roles permissions: protocol allowlist, selector allowlist, parameter bounds
4. Set WithdrawalGuard
5. Register vault in global registry

**Key design decisions:**
- Deterministic addresses allow custodians to pre-compute vault addresses for QC mint destinations
- Batched setup in one transaction reduces gas and eliminates partial-setup states
- Factory is permissionless — anyone can deploy a vault (LISA). Operator authority is configured separately for MLISA.

### WithdrawalGuard (~150 LOC)

Safe Guard that intercepts every transaction before execution. Enforces:

- If the transaction sends ETH or transfers ERC-20 tokens OUT of the vault, the recipient must be either:
  - The client's registered return address (set at vault creation, changeable by owner with timelock)
  - An approved protocol contract (Aave pool, Morpho market, etc.)
- Prevents operator (MLISA) from extracting funds to arbitrary addresses
- Prevents compromised operator key from draining vaults

**Attack surface this prevents:**
- Rogue operator sends collateral to their own address
- Compromised operator key drains vault
- Malicious recipe that routes funds through an unapproved contract

### RiskParamRegistry (~150 LOC)

On-chain parameter store. Can be global (shared across all vaults) or per-vault.

**Parameters stored:**
- `maxLTV[protocol]` — maximum LTV allowed for a given lending protocol
- `minPoolLiquidity[protocol][asset]` — minimum available liquidity in the protocol pool for the position's asset pair (prevents depositing into illiquid pools)
- `maxPositionSize[protocol]` — maximum position size per vault per protocol
- `velocityLimit[vault]` — maximum value that can flow through the vault per time period

**Enforcement:** Zodiac Roles permissions reference the registry. Before executing a lending operation, the Roles module checks that the operation doesn't violate registry constraints. If it does, the transaction reverts.

**Governance:** Registry updates are controlled by VaultConfigurator (timelocked or multisig). Individual vault owners cannot override global risk parameters — this is the institutional control layer.

### VaultConfigurator (~100 LOC)

Admin contract for Syenite's operational management:

- Add/remove protocols from the global allowlist
- Update risk parameters in the registry
- Grant/revoke operator authority for MLISA vaults
- Emergency pause (circuit breaker for all vaults)

**Access control:** Timelocked multisig. No single key can modify risk parameters or protocol allowlists. Emergency pause is the only single-key action (for incident response), and it only prevents new operations — it does not prevent withdrawals (clients can always exit).

---

## 3. Per-Tier Configuration

| | LISA | MLISA | ML |
|---|---|---|---|
| **Vault owner** | Client | Client | Syenite |
| **Vault operator** | Client signs directly | Syenite operator key (via Zodiac Roles, constrained) | Syenite operator key |
| **Withdrawal destination** | Client's registered address | Client's registered address | Client's designated return address |
| **Protocol allowlist** | Global (shared) | Global (shared) | Global (shared) |
| **Risk parameters** | Global defaults | Global defaults (operator can tighten, not loosen) | Global defaults |
| **Auto-unwind** | Opt-in (client configures trigger) | Always-on (Syenite manages) | Always-on |
| **Rebalancing** | Opt-in (client approves) | Automatic (Syenite decides) | Automatic |

---

## 4. Execution Flow: Auto-Unwind

The highest-value capability. Sequence for a CLOSE_FULL on Aave v3:

```
Trigger: vault health factor < configured threshold (e.g., 1.15)

1. Keeper detects trigger condition
2. Keeper simulates on forked state:
   a. Flash borrow USDC from Aave/Balancer
   b. Repay vault's USDC debt on Aave
   c. Withdraw wBTC collateral from Aave
   d. Swap wBTC → USDC via DEX aggregator (1inch/Paraswap)
   e. Repay flash loan + fee
   f. Send remaining wBTC (or USDC) to client's registered address
3. Simulation validates: tx succeeds, slippage < max, output > minimum
4. Keeper submits tx (optionally via private relay for MEV protection)
5. Tx executes atomically — all steps in one transaction
6. If any step fails, entire tx reverts — no partial state

Result:
- Client's debt: 0
- Client's collateral: returned (minus swap cost + flash fee, typically < 1%)
- Protocol liquidation penalty avoided (typically 5-10%)
- Client saved: ~4-9% of position value
```

For DELEVERAGE_STEP, same flow but partial: repay X% of debt, withdraw proportional collateral, reduce LTV to target. Position remains open.

---

## 5. Execution Flow: Cross-Protocol Migration

Sequence for migrating a position from Aave v3 to Morpho Blue:

```
Trigger: Morpho borrow rate < Aave borrow rate by > threshold for > duration

1. Keeper detects rate differential (rate scanner agent)
2. Keeper evaluates: (rate_delta × expected_duration × position_size) > (gas_cost + slippage)
3. Keeper simulates on forked state:
   a. Flash borrow USDC (amount = current debt)
   b. Repay USDC debt on Aave
   c. Withdraw wBTC collateral from Aave
   d. Deposit wBTC as collateral on Morpho Blue
   e. Borrow USDC on Morpho Blue (same amount)
   f. Repay flash loan
4. Simulation validates: tx succeeds, new position health is acceptable
5. Keeper submits tx
6. Tx executes atomically

Result:
- Same position, better rate
- Client captures rate improvement
- Syenite captures 15-20% of incremental yield (performance fee)
```

---

## 6. Gas Costs

### Per-Client Vault Setup (One-Time)

| Operation | Approx. Gas | Cost at 10 gwei / $2,500 ETH |
|---|---|---|
| Deploy Safe proxy | ~250-350K | ~$6-9 |
| Enable Zodiac Roles Modifier | ~60-100K | ~$1.50-2.50 |
| Configure Roles permissions | ~100-300K | ~$2.50-7.50 |
| Enable WithdrawalGuard | ~60-80K | ~$1.50-2.00 |
| **Total vault setup** | **~470-830K** | **~$12-21** |

### Per-Operation

| Operation | Approx. Gas | Cost at 10 gwei |
|---|---|---|
| Deposit + Borrow (Aave) | ~300-500K | ~$7.50-12.50 |
| Auto-unwind (CLOSE_FULL) | ~800K-1.2M | ~$20-30 |
| Cross-protocol migration | ~1-1.5M | ~$25-37.50 |
| Module routing overhead | ~30-50K per tx | ~$0.75-1.25 |

At low gas (3-5 gwei), all costs roughly halve.

---

## 7. Licensing

| Component | License | Implication |
|---|---|---|
| Safe contracts | LGPL-3.0 | No modification needed. Deploy unmodified proxies. Custom Guards/Modules are separate works. |
| Zodiac Roles Modifier | LGPL-3.0 | Same as Safe. |
| DeFi Saver v3 contracts | MIT | Fork freely. Modify freely. No copyleft obligations. |
| Morpho Blue | GPL-2.0 / BSL | Integrate as venue (call externally). Do NOT embed/modify code. |
| Syenite custom contracts | Proprietary | VaultFactory, WithdrawalGuard, RiskParamRegistry, VaultConfigurator. |
| Syenite MCP server | MIT (open core) | Free tier open source. Paid execution tier proprietary. |
| Syenite risk framework | Proprietary | Core IP. Not open source. |

Commercial precedent for Safe LGPL: Aave, CoW Protocol, 1inch, EigenLayer all build on Safe without releasing proprietary code. Counsel should confirm in a 30-minute review.
