export function landingPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Syenite — DeFi Lending Intelligence for AI Agents</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #e0e0e0; background: #0a0a0f; }
    a { color: #7c6cf0; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }
    .hero { padding: 4rem 0 2rem; text-align: center; }
    .hero h1 { font-size: 2.4rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
    .hero h1 span { color: #7c6cf0; }
    .hero p { font-size: 1.15rem; color: #999; max-width: 600px; margin: 0 auto; }
    .badge { display: inline-block; background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 4px; padding: 0.2rem 0.6rem; font-size: 0.8rem; color: #7c6cf0; margin-bottom: 1rem; }
    section { margin-top: 3rem; }
    h2 { font-size: 1.5rem; color: #fff; margin-bottom: 1rem; border-bottom: 1px solid #1a1a2e; padding-bottom: 0.5rem; }
    h3 { font-size: 1.1rem; color: #c0c0c0; margin: 1.5rem 0 0.5rem; }
    .tool-card { background: #111118; border: 1px solid #1a1a2e; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
    .tool-name { font-family: 'SF Mono', 'Fira Code', monospace; color: #7c6cf0; font-size: 1rem; font-weight: 600; }
    .tool-desc { color: #999; margin: 0.5rem 0; font-size: 0.95rem; }
    pre { background: #111118; border: 1px solid #1a1a2e; border-radius: 6px; padding: 1rem; overflow-x: auto; font-size: 0.85rem; line-height: 1.5; margin: 0.75rem 0; }
    code { font-family: 'SF Mono', 'Fira Code', monospace; color: #c0c0c0; }
    .param { color: #7c6cf0; }
    .string { color: #98c379; }
    .comment { color: #555; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #1a1a2e; font-size: 0.9rem; }
    th { color: #999; font-weight: 500; }
    td code { background: #1a1a2e; padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.85rem; }
    .footer { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #1a1a2e; text-align: center; color: #555; font-size: 0.85rem; }
  </style>
</head>
<body>
<div class="container">
  <div class="hero">
    <div class="badge">MCP Server &middot; Free Tier</div>
    <h1><span>Syenite</span> Lending</h1>
    <p>Cross-protocol BTC lending rates, position monitoring, and risk assessment for AI agents. Aave v3 + Morpho Blue on Ethereum mainnet.</p>
  </div>

  <section>
    <h2>Quick Start</h2>
    <h3>Claude Desktop / Cursor</h3>
    <p>Add to your MCP configuration:</p>
    <pre><code>{
  <span class="param">"mcpServers"</span>: {
    <span class="param">"syenite-lending"</span>: {
      <span class="param">"url"</span>: <span class="string">"YOUR_SERVER_URL/mcp"</span>,
      <span class="param">"headers"</span>: {
        <span class="param">"Authorization"</span>: <span class="string">"Bearer YOUR_API_KEY"</span>
      }
    }
  }
}</code></pre>

    <h3>cURL test</h3>
    <pre><code>curl -X POST YOUR_SERVER_URL/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'</code></pre>
  </section>

  <section>
    <h2>Tools</h2>

    <div class="tool-card">
      <div class="tool-name">lending.rates.query</div>
      <div class="tool-desc">Real-time BTC lending rates across Aave v3 and Morpho Blue. Compare borrow APY, supply APY, liquidity, and utilization across protocols and BTC wrappers.</div>
      <table>
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        <tr><td><code>collateral</code></td><td>string</td><td>"wBTC", "tBTC", "cbBTC", or "all"</td></tr>
        <tr><td><code>borrowAsset</code></td><td>string</td><td>"USDC", "USDT", or "DAI"</td></tr>
      </table>
    </div>

    <div class="tool-card">
      <div class="tool-name">lending.market.overview</div>
      <div class="tool-desc">Aggregate view of BTC lending markets. Protocol-level totals for TVL, utilization, rate ranges, and available liquidity.</div>
      <table>
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        <tr><td><code>collateral</code></td><td>string</td><td>"wBTC", "tBTC", "cbBTC", or "all"</td></tr>
      </table>
    </div>

    <div class="tool-card">
      <div class="tool-name">lending.position.monitor</div>
      <div class="tool-desc">Health check for any existing BTC lending position. Returns LTV, health factor, liquidation price, distance to liquidation, and estimated annual cost.</div>
      <table>
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        <tr><td><code>address</code></td><td>string</td><td>Ethereum address to check</td></tr>
        <tr><td><code>protocol</code></td><td>string</td><td>"aave-v3", "morpho", or "all"</td></tr>
      </table>
    </div>

    <div class="tool-card">
      <div class="tool-name">lending.risk.assess</div>
      <div class="tool-desc">Risk assessment for a proposed lending position. Returns risk score, recommended protocol, liquidation analysis, wrapper risk, and whether auto-unwind protection is recommended.</div>
      <table>
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        <tr><td><code>collateral</code></td><td>string</td><td>"wBTC", "tBTC", or "cbBTC"</td></tr>
        <tr><td><code>collateralAmount</code></td><td>number</td><td>Amount in BTC</td></tr>
        <tr><td><code>borrowAsset</code></td><td>string</td><td>"USDC", "USDT", or "DAI"</td></tr>
        <tr><td><code>targetLTV</code></td><td>number</td><td>Desired LTV (1-99)</td></tr>
        <tr><td><code>protocol</code></td><td>string</td><td>"aave-v3", "morpho", or "best"</td></tr>
      </table>
    </div>
  </section>

  <section>
    <h2>API Key</h2>
    <p>All tools are free. An API key is required for rate limiting and usage tracking. Contact the Syenite team or check the GitHub repo for key request instructions.</p>
  </section>

  <section>
    <h2>Data Sources</h2>
    <p>All data is read directly from on-chain contracts via Ethereum RPC — no intermediary APIs or off-chain oracles. Rates and positions are real-time. Prices use Chainlink feeds. Data is cached briefly (15-60s) for performance.</p>
    <table>
      <tr><th>Protocol</th><th>Contracts</th><th>Markets</th></tr>
      <tr><td>Aave v3</td><td>Pool, PoolDataProvider</td><td>wBTC, tBTC, cbBTC</td></tr>
      <tr><td>Morpho Blue</td><td>Morpho, AdaptiveCurveIRM</td><td>wBTC/USDC, tBTC/USDC, cbBTC/USDC</td></tr>
      <tr><td>Chainlink</td><td>Price Feeds</td><td>BTC/USD, ETH/USD, USDC/USD</td></tr>
    </table>
  </section>

  <div class="footer">
    <p>Syenite &middot; Institutional BTC lending infrastructure &middot; <a href="https://github.com">GitHub</a></p>
  </div>
</div>
</body>
</html>`;
}
