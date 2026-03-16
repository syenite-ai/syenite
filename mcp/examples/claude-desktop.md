# Connect Syenite to Claude Desktop

## Setup

1. Open Claude Desktop settings
2. Navigate to the MCP Servers section
3. Add the following configuration:

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

4. Restart Claude Desktop

## Example Prompts

Once connected, try asking Claude:

- "What are the current BTC lending rates across DeFi protocols?"
- "Compare wBTC vs tBTC lending conditions on Aave and Morpho"
- "Check the lending position health for address 0x..."
- "I want to deposit 2 BTC as collateral and borrow USDC at 50% LTV. What are the risks?"
- "Which protocol has the lowest borrow rate for cbBTC right now?"
- "Give me a market overview of all BTC lending on Ethereum"

Claude will automatically call the appropriate Syenite tools and present the data.
