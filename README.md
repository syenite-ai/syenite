# Syenite

The DeFi interface for AI agents. One MCP endpoint for swaps, bridges, yield, lending, prediction markets, strategy search, alerts, wallet and gas tools, and a **trust layer** (verify, simulate, guard before sign) across 30+ chains.

## What This Is

Syenite is an MCP server for agentic DeFi: swap and bridge routing, yield and multi-chain lending intelligence, Polymarket-style prediction data and signals, carry screening and `find.strategy`, position alerts, balances and gas estimates, plus `tx.verify`, `tx.simulate`, and `tx.guard` so agents can check calldata before a key is used. **Intelligence and execution in one place** (unsigned only).

Agents read data, get quotes, and receive unsigned transactions ready to sign. **Syenite never holds private keys** — no custody, no API key required, rate-limited for production use. [Docs](https://syenite.ai/docs) · [Tool reference](https://syenite.ai/) (homepage lists all tools).

**Live at [syenite.ai/mcp](https://syenite.ai/mcp)**

## Quick Start

```json
{
  "mcpServers": {
    "syenite": {
      "url": "https://syenite.ai/mcp"
    }
  }
}
```

No API key needed. 30 requests/minute per IP.

## Tools (summary)

| Area | Examples |
|------|----------|
| **Swap & bridge** | `swap.quote`, `swap.multi`, `swap.status` |
| **Trust layer** | `tx.verify`, `tx.simulate`, `tx.guard` |
| **Wallet & gas** | `wallet.balances`, `gas.estimate` |
| **Yield & lending** | `yield.opportunities`, `yield.assess`, `lending.rates.query`, `lending.position.monitor`, `lending.risk.assess`, … |
| **Strategy & prediction** | `strategy.carry.screen`, `find.strategy`, `prediction.trending`, `prediction.search`, `prediction.book`, `prediction.signals` |
| **Alerts** | `alerts.watch`, `alerts.check`, `alerts.list`, `alerts.remove` |

Full tables and parameters: [`mcp/README.md`](mcp/README.md) or call `syenite.help` on the live endpoint.

## Architecture

```
Agent → syenite.ai/mcp
         ├── swap.*            → Li.Fi (1inch, 0x, Paraswap, bridges)
         ├── tx.verify/simulate/guard → RPC + Etherscan/Sourcify/registry
         ├── yield.* / lending.* → On-chain + oracles
         ├── prediction.*      → Polymarket data
         ├── strategy.* / find.strategy → Aggregated scans
         └── alerts.*          → Position monitoring
```

Swap routing via Li.Fi aggregation. Yield and lending from on-chain contracts and feeds. Trust tools use public RPC `eth_call` and third-party verification APIs.

## Yield Sources

- **Lending Supply**: Aave v3, Morpho Blue, Spark
- **Liquid Staking**: Lido (stETH/wstETH), Rocket Pool (rETH), Coinbase (cbETH)
- **Savings Rate**: Maker DSR (sDAI)
- **Vaults**: MetaMorpho (Steakhouse, Gauntlet), Yearn v3
- **Basis Capture**: Ethena (sUSDe)

## Supported Chains (Swap/Bridge)

Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche, zkSync, Linea, Scroll, Gnosis, Fantom, and 20+ more.

## How Execution Works

`swap.quote` (and similar) returns an unsigned `transactionRequest`. Use `tx.verify`, `tx.simulate`, and `tx.guard` before signing when you need independent checks. The agent or user signs and submits from their own wallet. For cross-chain bridges, `swap.status` tracks progress. Syenite never holds keys.

## Product Tiers

| Tier | Who Operates | Who Custodies | Target |
|---|---|---|---|
| **LISA** | Client signs | Client's custodian | Institutions wanting self-service lending |
| **MLISA** | Syenite operates | Client's custodian | Institutions wanting managed lending |
| **ML** | Syenite operates | Syenite's custodian | Full-service managed lending |

All tiers share the same vault infrastructure (Safe smart accounts + Zodiac Roles).

## Distribution Channels

1. **MCP DeFi Router** — the canonical tool interface for AI agents. Free data drives adoption; execution tools generate revenue via integrator fees on swap/bridge volume. Live at [syenite.ai/mcp](https://syenite.ai/mcp).
2. **AC Smart Accounts** — whitelisted adaptor on Threshold institutional UI.
3. **Direct Platform** — institutions use Syenite vaults directly (LISA/MLISA).
4. **B2B Infra** — lending desks integrate vault API + risk framework.

## Project Structure

```
syenite/
├── docs/
│   ├── planning/         # Build plan, milestones
│   ├── architecture/     # Product architecture, vault design
│   ├── research/         # Position management, protocol analysis, MCP landscape
│   ├── commercial/       # Revenue model, market segments
│   └── competitive/      # Competitive landscape
├── contracts/            # Solidity (when build starts)
├── keeper/               # Keeper agent infrastructure
├── mcp/                  # MCP DeFi server (live)
└── frontend/             # Minimal UI
```

## Status

MCP server is live at [syenite.ai](https://syenite.ai) with swap/bridge (30+ chains), yield and multi-chain lending, prediction markets and signals, carry and strategy search, alerts, wallet/gas tools, and the tx trust layer. Vault contracts are a parallel build track.

**Source:** [github.com/syenite-ai/syenite](https://github.com/syenite-ai/syenite)
