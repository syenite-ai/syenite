# Syenite — DeFi MCP Server for AI Agents

> **Retired.** The hosted endpoint at `syenite.ai/mcp` has been shut down, and the
> package is deprecated on npm. The source remains here, unmaintained, under MIT.
>
> Syenite ran from March to August 2026. It can still be run locally — see
> [Running It Yourself](#running-it-yourself) — but nothing is hosted and no
> support is offered.

A DeFi interface for AI agents via the Model Context Protocol (MCP). One endpoint covered lending rates across Aave, Morpho, Compound, and Spark; yield discovery; swap and bridge routing across 30+ chains; Polymarket and Kalshi prediction markets; position alerts; and a trust layer that verified and simulated calldata before signing.

---

## What It Does

Syenite is an MCP server that gives AI agents composable access to DeFi. Agents can query borrow and supply rates across every major lending protocol, find yield opportunities from lending and staking to Pendle fixed-rate markets, route swaps and bridges via LI.FI aggregation, read Polymarket prediction markets and signals, and set webhook alerts for health factor changes. All execution tools return unsigned calldata — the agent passes it to a connected wallet; Syenite never holds keys.

---

## Running It Yourself

The hosted endpoint is gone, but stdio mode is self-contained — it talks directly to
Aave, Morpho, LI.FI, Polymarket, and Kalshi, with no dependency on syenite.ai. Build
from source:

```bash
git clone https://github.com/syenite-ai/syenite.git
cd syenite/mcp && npm install && npm run build
```

Then point an MCP client at it:

```json
{
  "mcpServers": {
    "syenite": {
      "command": "node",
      "args": ["/absolute/path/to/syenite/mcp/dist/stdio.js"]
    }
  }
}
```

The last version published to npm was `0.5.0`; this repo is at `0.6.3`, so building
from source is the only way to get the Kalshi and cross-exchange prediction tools.

Two caveats: the four `alerts.*` tools need a Postgres instance (`DATABASE_URL`) and
will fail without one, and some upstream APIs may have changed since this stopped
being maintained. Call `syenite.help` for the tool catalogue.

---

## Tools

### Lending Rates

| Tool | What it does | Protocols / chains |
|------|-------------|-------------------|
| `lending.rates.query` | Borrow and supply rates for any asset | Aave v3, Morpho Blue, Spark, Compound v3, Fluid — Ethereum, Arbitrum, Base |
| `lending.market.overview` | Aggregate TVL, utilisation, rate ranges per protocol | Same protocols |
| `lending.position.monitor` | Health factor, liquidation distance, and cost for any address | Aave v3, Morpho Blue, Spark |
| `lending.risk.assess` | Risk assessment for a proposed lending position | Same protocols |
| `strategy.carry.screen` | Screen all markets for positive carry (supply APY > borrow APY) | All lending protocols |

### Lending Execution

| Tool | What it does | Protocols / chains |
|------|-------------|-------------------|
| `lending.supply` | Unsigned calldata to supply collateral | Aave v3, Morpho Blue, Spark, Compound v3 |
| `lending.borrow` | Unsigned calldata to borrow an asset | Same protocols |
| `lending.withdraw` | Unsigned calldata to withdraw supplied collateral | Same protocols |
| `lending.repay` | Unsigned calldata to repay a borrow | Same protocols |

### Yield

| Tool | What it does | Protocols / chains |
|------|-------------|-------------------|
| `yield.opportunities` | Best yield across lending, staking, vaults, Pendle, and savings rate | Aave, Morpho, Spark, Lido, Rocket Pool, Pendle, Yearn, Ethena, Maker DSR |
| `yield.assess` | Deep risk assessment for a specific yield strategy | All sources |
| `find.strategy` | Composable scan: yield, carry, gas, optional prediction signals | Cross-protocol |

### Carry Trade

| Tool | What it does | Protocols / chains |
|------|-------------|-------------------|
| `strategy.carry.screen` | Find assets where supply APY exceeds borrow APY across all markets | Aave v3, Morpho, Compound, Spark |

### Swap & Bridge

| Tool | What it does | Protocols / chains |
|------|-------------|-------------------|
| `swap.quote` | Optimal swap or bridge quote with unsigned tx calldata | LI.FI aggregation — 30+ chains |
| `swap.multi` | Batch up to 10 swap/bridge quotes in parallel | Same |
| `swap.status` | Track cross-chain bridge delivery | Same |

### Prediction Markets

| Tool | What it does | Protocols / chains |
|------|-------------|-------------------|
| `prediction.trending` | Top Polymarket events by volume — probabilities, liquidity, spread | Polymarket |
| `prediction.search` | Search prediction markets by topic | Polymarket |
| `prediction.book` | Order book depth and spread for an outcome token | Polymarket |
| `prediction.signals` | Actionable signals: extreme probabilities, volume, mispricing-style flags | Polymarket |

### Position Alerts

| Tool | What it does | Protocols / chains |
|------|-------------|-------------------|
| `alerts.watch` | Register an address for health factor monitoring; optional `webhookUrl` for push | Aave v3, Morpho Blue, Spark |
| `alerts.check` | Poll for active alerts on watched addresses | Same |
| `alerts.list` | List all active watches | — |
| `alerts.remove` | Remove a watch | — |

### Wallet & Gas

| Tool | What it does | Protocols / chains |
|------|-------------|-------------------|
| `wallet.balances` | Native and stablecoin balances | Ethereum, Arbitrum, Base, BNB Chain |
| `gas.estimate` | Live gas prices and per-operation cost estimates; finds the cheapest chain | Same |

### Trust Layer

| Tool | What it does | Protocols / chains |
|------|-------------|-------------------|
| `tx.verify` | Verify a contract via Etherscan, Sourcify, and Syenite protocol registry; surfaces risk flags | Any EVM chain |
| `tx.simulate` | `eth_call` simulation: revert detection, gas estimate, native value effects | Ethereum, Arbitrum, Base |
| `tx.guard` | Apply your own rules: value caps, allowlists, blocklists, registry requirement | — |
| `tx.receipt` | Post-signing confirmation: status, gas cost, decoded events, token transfers | Any EVM chain |

---

## Supported Protocols

| Protocol | Category | What Syenite provides |
|----------|----------|-----------------------|
| **Aave v3** | Lending | Supply/borrow rates, position monitoring, execution calldata |
| **Morpho Blue** | Lending | Supply/borrow rates, market overview, execution calldata |
| **Compound v3** | Lending | Supply/borrow rates, execution calldata |
| **Spark** | Lending | Supply/borrow rates, position monitoring, execution calldata |
| **Pendle** | Yield | Fixed-rate and yield-tokenisation opportunities via `yield.opportunities` |
| **LI.FI** | Swap/bridge | Aggregated routing across DEXs and bridges on 30+ chains |
| **Polymarket** | Prediction markets | Market data, order books, trending events, actionable signals |

---

## Supported Chains

**Swap and bridge (via LI.FI):** Ethereum, Arbitrum, Base, Optimism, Polygon, BNB Chain, Avalanche, zkSync, Linea, Scroll, Gnosis, Fantom, and 20+ more.

**Lending rates, execution, and position monitoring:** Ethereum, Arbitrum, Base (per protocol availability).

**Wallet, gas, and trust simulation:** Ethereum, Arbitrum, Base, BNB Chain.

---

## How Execution Works

All execution tools (`lending.supply`, `lending.borrow`, `lending.withdraw`, `lending.repay`, `swap.quote`) return unsigned `transactionRequest` objects — calldata ready to sign. The recommended flow:

1. Get the calldata from the relevant tool.
2. Run `tx.verify` and `tx.simulate` to check the contract and preview effects.
3. Optionally run `tx.guard` to enforce value caps or allowlists.
4. Sign and submit from your own wallet.
5. Confirm with `tx.receipt`.

**Syenite never holds private keys or custody of funds.**

---

## Agent Integration

Syenite is designed for agent-native DeFi workflows. Every tool is an atomic primitive: agents compose them to achieve outcomes like "find the best lending rate for wBTC, supply collateral, and set a health factor alert."

The server included scaffolding for [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)
on-chain agent registration (Ethereum, Arbitrum, Base, BNB Chain) via
`src/scripts/register-agent.ts`, and served an
`x402`-flagged `.well-known/agent-registration.json`. No agent IDs were ever
configured in production, so the served registration list was always empty.

The `server.json` manifest includes a `systemPrompt` field that MCP clients can inject to orient the agent on Syenite's capabilities automatically.

Call `syenite.help` for the full capability overview including all tool parameters.

---

## Yield Sources

| Source | Type |
|--------|------|
| Aave v3, Morpho Blue, Spark, Compound v3 | Lending supply APY |
| Lido (stETH/wstETH), Rocket Pool (rETH), Coinbase (cbETH) | Liquid staking |
| Maker DSR (sDAI) | Savings rate |
| MetaMorpho (Steakhouse, Gauntlet), Yearn v3 | Vaults |
| Pendle | Fixed-rate / yield tokenisation |
| Ethena (sUSDe) | Basis capture |

---

## Project Structure

```
syenite/
├── mcp/          # MCP DeFi server (live at syenite.ai/mcp)
├── docs/         # Architecture, planning, research, commercial
├── contracts/    # Solidity vault contracts (parallel build)
├── keeper/       # Keeper agent infrastructure
└── frontend/     # Minimal UI
```

---

## Status

Retired as of August 2026. The hosted endpoint, the docs site, and the usage
dashboard are all offline. `@syenite/mcp` is deprecated on npm and the MCP Registry
listing has been removed.

Final tally: 46 tools across 8 protocol families, ~20k lines of TypeScript, and
574 logged calls over five months — most of them from an automated registry
health-check rather than real users.

**Source:** [github.com/syenite-ai/syenite](https://github.com/syenite-ai/syenite) · MIT
