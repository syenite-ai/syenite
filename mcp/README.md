# @syenite/mcp

Composable DeFi intelligence for AI agents — swap routing, bridge execution, yield analysis, lending rates, prediction markets, risk assessment, and wallet operations via the [Model Context Protocol](https://modelcontextprotocol.io).

**One endpoint. 30+ chains. No API key required.**

## Quick Start

### Claude Desktop / Cursor (remote)

```json
{
  "mcpServers": {
    "syenite": {
      "url": "https://syenite.ai/mcp"
    }
  }
}
```

### npx (local stdio)

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

### cURL

```bash
curl -X POST https://syenite.ai/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "lending.rates.query",
      "arguments": { "collateral": "wBTC" }
    },
    "id": 1
  }'
```

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

### Prediction Markets

| Tool | Description |
|------|-------------|
| `prediction.trending` | Top Polymarket events by volume — probabilities, liquidity, spread |
| `prediction.search` | Search prediction markets by topic |
| `prediction.book` | Order book depth and spread for an outcome token |

### Alerts

| Tool | Description |
|------|-------------|
| `alerts.watch` | Register an address for health factor monitoring |
| `alerts.check` | Poll for active alerts |
| `alerts.list` | List all active watches |
| `alerts.remove` | Remove a watch |

## How Execution Works

Syenite never holds private keys. `swap.quote` returns an unsigned `transactionRequest` with optimal route calldata. The agent or user signs and submits from their own wallet. For cross-chain bridges, use `swap.status` to track delivery.

## Supported Chains

**Swap/Bridge:** Ethereum, Arbitrum, Base, Optimism, Polygon, BNB Chain, Avalanche, zkSync, Linea, Scroll, and 20+ more.

**Lending data:** Ethereum, Arbitrum, Base, BNB Chain.

**Protocols:** Aave v3, Morpho Blue, Spark, Compound V3, Fluid, Venus.

## Access

Open access — no API key required. Rate limited to 30 req/min per IP.

- **Remote:** `https://syenite.ai/mcp`
- **Local:** `npx @syenite/mcp` (stdio transport)
- **Docs:** [syenite.ai/docs](https://syenite.ai/docs)

## ERC-8004 Registered Agent

Syenite is a registered on-chain agent via [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) on Base, Ethereum, Arbitrum, and BNB Chain. Supports [x402](https://www.x402.org/) machine-to-machine payments.

## License

MIT
