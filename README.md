# Syenite

The DeFi interface for AI agents. One MCP endpoint for swaps, bridges, yield, lending, and risk across 30+ chains.

## What This Is

Syenite is an MCP server that gives AI agents everything they need to interact with DeFi — swap routing, cross-chain bridges, yield intelligence, lending rates, risk assessment, and position monitoring. **Intelligence and execution in one place** (not swap-only).

Agents read data, get quotes, and receive unsigned transactions ready to sign. **Syenite never holds private keys** — no custody, no API key required, rate-limited for production use.

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

## Tools

### Swap & Bridge
| Tool | Description |
|---|---|
| `swap.quote` | Optimal swap/bridge quote with unsigned transaction calldata. 30+ chains via 1inch, 0x, Paraswap, and bridge aggregation |
| `swap.status` | Track cross-chain bridge execution status |

### Yield Intelligence
| Tool | Description |
|---|---|
| `yield.opportunities` | Best yields across lending supply, liquid staking, vaults, savings rates, and basis capture |
| `yield.assess` | Deep risk assessment for any yield strategy |

### Lending
| Tool | Description |
|---|---|
| `lending.rates.query` | Borrow/supply rates across Aave v3, Morpho Blue, Spark |
| `lending.market.overview` | Aggregate market view — TVL, utilization, rate ranges |
| `lending.position.monitor` | Health factor, liquidation distance for any address |
| `lending.risk.assess` | Risk assessment for proposed lending positions |

### Utility
| Tool | Description |
|---|---|
| `syenite.help` | Service info, available tools, supported chains |

## Architecture

```
Agent → syenite.ai/mcp
         ├── swap.quote        → Li.Fi API (1inch, 0x, Paraswap, bridges)
         ├── swap.status       → Li.Fi status tracking
         ├── yield.*           → On-chain data (Aave, Lido, Morpho, Yearn, Ethena, Maker, ...)
         └── lending.*         → On-chain data (Aave v3, Morpho Blue, Spark)
```

Swap routing via Li.Fi aggregation. Yield and lending data sourced directly from on-chain contracts via Ethereum RPC with Chainlink price feeds.

## Yield Sources

- **Lending Supply**: Aave v3, Morpho Blue, Spark
- **Liquid Staking**: Lido (stETH/wstETH), Rocket Pool (rETH), Coinbase (cbETH)
- **Savings Rate**: Maker DSR (sDAI)
- **Vaults**: MetaMorpho (Steakhouse, Gauntlet), Yearn v3
- **Basis Capture**: Ethena (sUSDe)

## Supported Chains (Swap/Bridge)

Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche, zkSync, Linea, Scroll, Gnosis, Fantom, and 20+ more.

## How Execution Works

`swap.quote` returns an unsigned `transactionRequest` with optimised calldata. The agent or user signs and submits from their own wallet. For cross-chain bridges, `swap.status` tracks progress. Syenite never holds keys.

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

MCP server is live at [syenite.ai](https://syenite.ai) with swap/bridge routing (30+ chains), yield intelligence (10+ protocols), and lending tools (Aave v3, Morpho Blue, Spark). Vault contracts are a parallel build track.

**Source:** [github.com/syenite-ai/syenite](https://github.com/syenite-ai/syenite)
