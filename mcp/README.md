# @syenite/mcp-lending

DeFi lending intelligence for AI agents — cross-protocol BTC rates, position monitoring, and risk assessment via the [Model Context Protocol](https://modelcontextprotocol.io).

**Live data from Aave v3 and Morpho Blue on Ethereum mainnet.**

## Tools

| Tool | Description |
|------|-------------|
| `lending.rates.query` | Real-time BTC lending rates across protocols. Compare borrow APY, supply APY, liquidity, and utilization for wBTC, tBTC, cbBTC. |
| `lending.market.overview` | Aggregate market view — per-protocol TVL, total borrowed, utilization ranges, rate ranges. |
| `lending.position.monitor` | Health check for any address's BTC lending position. Returns LTV, health factor, liquidation price, distance to liquidation. |
| `lending.risk.assess` | Risk assessment for proposed positions. Risk score, recommended protocol, liquidation analysis, wrapper-specific risk notes. |

## Quick Start

### Claude Desktop / Cursor

Add to your MCP config (`~/.cursor/mcp.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "syenite-lending": {
      "url": "https://your-server-url/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### OpenAI Agents SDK (Python)

```python
from openai import OpenAI
import httpx, json

client = OpenAI()
SERVER_URL = "https://your-server-url/mcp"
API_KEY = "YOUR_API_KEY"

def call_syenite(tool_name: str, args: dict) -> dict:
    resp = httpx.post(
        SERVER_URL,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {API_KEY}",
        },
        json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": args},
            "id": 1,
        },
    )
    for line in resp.text.split("\n"):
        if line.startswith("data: "):
            data = json.loads(line[6:])
            return json.loads(data["result"]["content"][0]["text"])
    return {}

# Get BTC lending rates
rates = call_syenite("lending.rates.query", {"collateral": "all"})
print(f"Best borrow rate: {rates['bestBorrowRate']['borrowAPY']}% on {rates['bestBorrowRate']['market']}")

# Assess risk of a 1 BTC position at 50% LTV
risk = call_syenite("lending.risk.assess", {
    "collateral": "wBTC",
    "collateralAmount": 1,
    "targetLTV": 50,
})
print(f"Risk score: {risk['assessment']['riskScore']}/10 — {risk['assessment']['summary']}")
```

### LangChain (Python)

```python
from langchain_core.tools import tool
import httpx, json

SERVER_URL = "https://your-server-url/mcp"
API_KEY = "YOUR_API_KEY"

def _call_mcp(tool_name: str, args: dict) -> dict:
    resp = httpx.post(
        SERVER_URL,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {API_KEY}",
        },
        json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": args},
            "id": 1,
        },
    )
    for line in resp.text.split("\n"):
        if line.startswith("data: "):
            data = json.loads(line[6:])
            return json.loads(data["result"]["content"][0]["text"])
    return {}

@tool
def get_btc_lending_rates(collateral: str = "all", borrow_asset: str = "USDC") -> str:
    """Get real-time BTC lending rates across Aave v3 and Morpho Blue."""
    result = _call_mcp("lending.rates.query", {"collateral": collateral, "borrowAsset": borrow_asset})
    return json.dumps(result, indent=2)

@tool
def assess_lending_risk(collateral: str, amount: float, target_ltv: float) -> str:
    """Assess risk of a proposed BTC lending position."""
    result = _call_mcp("lending.risk.assess", {
        "collateral": collateral,
        "collateralAmount": amount,
        "targetLTV": target_ltv,
    })
    return json.dumps(result, indent=2)
```

## Self-Hosting

### Docker

```bash
docker build -t syenite-mcp .
docker run -d \
  -p 3000:3000 \
  -e ALCHEMY_API_KEY=your_key \
  -e ADMIN_PASSWORD=your_password \
  -v syenite-data:/data \
  syenite-mcp
```

### Local Development

```bash
cp .env.example .env
# Edit .env with your Alchemy API key
npm install
npm run dev
```

### Generate an API Key

```bash
npm run generate-key -- --name "my-agent" --email "me@example.com"
```

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/mcp` | POST | MCP streamable HTTP endpoint (tool calls) |
| `/` | GET | Landing page with tool documentation |
| `/health` | GET | Health check (RPC connectivity, DB status) |
| `/dashboard` | GET | Admin dashboard (HTTP Basic auth) |
| `/.well-known/mcp.json` | GET | MCP server discovery metadata |

## Data Sources

All data is read directly from on-chain contracts via Ethereum RPC. No intermediary APIs.

- **Aave v3** — Pool, PoolDataProvider contracts (wBTC, tBTC, cbBTC reserves)
- **Morpho Blue** — Morpho, AdaptiveCurveIRM contracts (BTC/USDC markets)
- **Chainlink** — BTC/USD, ETH/USD, USDC/USD price feeds

Data is cached briefly (15–60s) for performance. Rates include compounding.

## License

MIT
