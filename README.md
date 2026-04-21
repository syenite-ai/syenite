# Syenite — DeFi MCP Server for AI Agents

The complete DeFi interface for AI agents via the Model Context Protocol (MCP). One endpoint covers lending rates across Aave, Morpho, Compound, and Spark; yield discovery; swap and bridge routing across 30+ chains; Polymarket prediction markets; position alerts; and a trust layer that verifies and simulates calldata before signing.

**Live at [syenite.ai](https://syenite.ai) · Docs at [syenite.ai/docs](https://syenite.ai/docs)**

---

## What It Does

Syenite is an MCP server that gives AI agents composable access to DeFi. Agents can query borrow and supply rates across every major lending protocol, find yield opportunities from lending and staking to Pendle fixed-rate markets, route swaps and bridges via LI.FI aggregation, read Polymarket prediction markets and signals, and set webhook alerts for health factor changes. All execution tools return unsigned calldata — the agent passes it to a connected wallet; Syenite never holds keys.

---

## Quick Start

Add to your MCP client config (Claude Desktop, Cursor, or any MCP-compatible agent):

```json
{
  "mcpServers": {
    "syenite": {
      "url": "https://syenite.ai/mcp"
    }
  }
}
```

Or run locally via stdio:

```json
{
  "mcpServers": {
    "syenite": {
      "command": "npx",
      "args": ["-y", "@syenite/mcp"]
    }
  }
}
```

No API key required. Rate limited to 30 requests/minute per IP.

Call `syenite.help` on the live endpoint for the full tool catalogue.

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

Syenite is a registered on-chain agent via [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) on Ethereum, Arbitrum, Base, and BNB Chain, and supports [x402](https://www.x402.org/) machine-to-machine payments.

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

MCP server is live at [syenite.ai/mcp](https://syenite.ai/mcp). Swap/bridge across 30+ chains, multi-protocol lending rates and execution, yield discovery, Polymarket prediction markets, carry screening, position alerts, wallet/gas tools, and the tx trust layer are all in production.

**npm:** [`@syenite/mcp`](https://www.npmjs.com/package/@syenite/mcp) · **Source:** [github.com/syenite-ai/syenite](https://github.com/syenite-ai/syenite) · **Docs:** [syenite.ai/docs](https://syenite.ai/docs)
