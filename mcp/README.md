# @syenite/mcp

> **This package is deprecated and unmaintained.**
>
> The hosted endpoint at `syenite.ai/mcp` has been shut down. This package is no
> longer published or supported. Source remains at
> [github.com/syenite-ai/syenite](https://github.com/syenite-ai/syenite) under MIT.

Composable DeFi intelligence for AI agents — swap routing, bridge execution, yield and lending with execution (supply, borrow, withdraw, repay), prediction markets, carry and strategy search, alerts with webhooks, wallet and gas tools, and a **trust layer** (`tx.verify`, `tx.simulate`, `tx.guard`, `tx.receipt`) for verification before and after signing — via the [Model Context Protocol](https://modelcontextprotocol.io).

## Running It Yourself

Stdio mode is self-contained — it queries Aave, Morpho, LI.FI, Polymarket, and
Kalshi directly, with no dependency on syenite.ai. Build from source:

```bash
git clone https://github.com/syenite-ai/syenite.git
cd syenite/mcp && npm install && npm run build
```

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

The last npm release was `0.5.0`; the repo is at `0.6.3`, so building from source is
the only way to get the Kalshi and cross-exchange prediction tools. The four
`alerts.*` tools require a Postgres instance (`DATABASE_URL`) and will fail without
one. Upstream protocol APIs may have changed since this stopped being maintained.

## Tools

### Wallet & Gas

| Tool | Description |
|------|-------------|
| `wallet.balances` | Native + stablecoin balances across Ethereum, Arbitrum, Base, BNB Chain |
| `gas.estimate` | Live gas prices and per-operation cost estimates. Finds the cheapest chain |

### Swap & Bridge

| Tool | Description |
|------|-------------|
| `swap.quote` | Optimal swap/bridge quote with unsigned tx calldata. 30+ chains via Li.Fi |
| `swap.multi` | Batch up to 10 swap/bridge quotes in parallel |
| `swap.status` | Track cross-chain bridge delivery |

### Trust layer

| Tool | Description |
|------|-------------|
| `tx.verify` | Etherscan + Sourcify + Syenite protocol registry; risk flags |
| `tx.simulate` | `eth_call` simulation: revert detection, gas estimate, native value effects |
| `tx.guard` | Your rules: value caps, allowlists, blocklists, registry requirement |
| `tx.receipt` | Post-signing confirmation: status, gas cost, decoded events, token transfers |

### Yield

| Tool | Description |
|------|-------------|
| `yield.opportunities` | Best yield across lending, staking, vaults, savings, basis capture |
| `yield.assess` | Deep risk assessment for a specific yield strategy |

### Lending

| Tool | Description |
|------|-------------|
| `lending.rates.query` | Borrow/supply rates across Aave v3, Morpho Blue, Spark, Compound V3, Fluid |
| `lending.market.overview` | Aggregate TVL, utilization, rate ranges per protocol |
| `lending.position.monitor` | Health factor, liquidation distance, costs for any address |
| `lending.risk.assess` | Risk assessment for proposed lending positions |
| `strategy.carry.screen` | Screen all markets for positive carry (supply APY > borrow APY) |
| `find.strategy` | Composable scan: yield, carry, gas, optional prediction signals for an asset |

### Prediction Markets

| Tool | Description |
|------|-------------|
| `prediction.trending` | Top Polymarket events by volume — probabilities, liquidity, spread |
| `prediction.search` | Search prediction markets by topic |
| `prediction.book` | Order book depth and spread for an outcome token |
| `prediction.signals` | Actionable signals: spreads, extreme probabilities, volume, mispricing-style flags |

### Alerts

| Tool | Description |
|------|-------------|
| `alerts.watch` | Register an address for health factor monitoring. Optional `webhookUrl` for push alerts |
| `alerts.check` | Poll for active alerts |
| `alerts.list` | List all active watches |
| `alerts.remove` | Remove a watch |

## How Execution Works

Syenite never holds private keys. `swap.quote`, `lending.supply`, `lending.borrow`, `lending.withdraw`, and `lending.repay` return unsigned `transactionRequest` objects. Before signing, use `tx.verify`, `tx.simulate`, and `tx.guard` on that payload. The agent or user signs and submits from their own wallet. After signing, confirm with `tx.receipt`. For cross-chain bridges, use `swap.status` to track delivery.

## Supported Chains

**Swap/Bridge:** Ethereum, Arbitrum, Base, Optimism, Polygon, BNB Chain, Avalanche, zkSync, Linea, Scroll, and 20+ more.

**Lending rates / markets / position monitor:** Ethereum, Arbitrum, Base (per protocol availability).

**Wallet, gas, trust simulation:** Ethereum, Arbitrum, Base, BNB Chain.

**Protocols:** Aave v3, Morpho Blue, Spark, Compound V3, Fluid, and others (see `syenite.help`).

## Access

Open access — no API key required. Rate limited to 30 req/min per IP.

- **Remote:** `https://syenite.ai/mcp`
- **Local:** `npx @syenite/mcp` (stdio transport)
- **Docs:** [syenite.ai/docs](https://syenite.ai/docs)

## ERC-8004 Registered Agent

Syenite is a registered on-chain agent via [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) on Base, Ethereum, Arbitrum, and BNB Chain. Supports [x402](https://www.x402.org/) machine-to-machine payments.

## License

MIT
