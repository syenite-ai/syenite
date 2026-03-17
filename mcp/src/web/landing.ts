export function landingPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>syenite — DeFi lending intelligence for AI agents</title>
  <meta name="description" content="Cross-protocol BTC lending rates, position monitoring, and risk assessment via MCP. Aave v3 + Morpho Blue on Ethereum mainnet.">
  <style>
    :root {
      --bg: #101010;
      --surface: #161616;
      --border: #1e1e1e;
      --text: #999;
      --heading: #c8c8c8;
      --muted: #555;
      --dim: #3a3a3a;
      --accent: #b09070;
      --accent-hover: #c4a080;
      --green: #8a9a7c;
      --mono: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'Liberation Mono', monospace;
      --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; -webkit-text-size-adjust: 100%; }

    body {
      font-family: var(--sans);
      line-height: 1.7;
      color: var(--text);
      background: var(--bg);
      padding: 0 1.25rem;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .wrap {
      max-width: 680px;
      margin: 0 auto;
      padding: 4rem 0 3rem;
    }

    /* ── typography ───────────────────────────── */

    h1, h2, h3 {
      font-family: var(--mono);
      font-weight: 500;
    }

    h1 {
      font-size: clamp(1.75rem, 5vw, 2.25rem);
      color: var(--heading);
      letter-spacing: -0.02em;
    }

    h2 {
      font-size: 0.8rem;
      color: var(--muted);
      text-transform: lowercase;
      letter-spacing: 0.1em;
      margin: 3.5rem 0 1.25rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    h3 {
      font-size: 0.85rem;
      color: #666;
      margin: 1.5rem 0 0.5rem;
      font-weight: 400;
    }

    p { margin-bottom: 0.75rem; }

    a {
      color: var(--accent);
      text-decoration: none;
      transition: color 0.15s;
    }

    a:hover { color: var(--accent-hover); }

    /* ── hero ─────────────────────────────────── */

    .hero { margin-bottom: 0.5rem; }

    .tag {
      display: block;
      font-family: var(--mono);
      font-size: 0.72rem;
      color: var(--muted);
      letter-spacing: 0.06em;
      margin-bottom: 1rem;
    }

    .lead {
      color: #777;
      font-size: 0.95rem;
      max-width: 540px;
      line-height: 1.7;
      margin-top: 0.75rem;
    }

    /* ── code ─────────────────────────────────── */

    pre {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem 1.25rem;
      overflow-x: auto;
      font-size: 0.8rem;
      line-height: 1.65;
      margin: 0.75rem 0 1.5rem;
      -webkit-overflow-scrolling: touch;
    }

    code {
      font-family: var(--mono);
      font-size: 0.85em;
    }

    pre code { color: #888; }

    .k { color: var(--accent); }
    .s { color: var(--green); }
    .c { color: var(--dim); }
    .prompt { color: var(--muted); user-select: none; }

    :not(pre) > code {
      background: #1a1a1a;
      padding: 0.15em 0.35em;
      border-radius: 3px;
      font-size: 0.82em;
      color: #aaa;
    }

    /* ── tools ────────────────────────────────── */

    .tool {
      margin-bottom: 2.25rem;
      padding-bottom: 2.25rem;
      border-bottom: 1px solid var(--border);
    }

    .tool:last-child { border-bottom: none; padding-bottom: 0; }

    .tool-name {
      font-family: var(--mono);
      color: var(--heading);
      font-size: 0.9rem;
      font-weight: 500;
    }

    .tool-desc {
      color: #777;
      font-size: 0.88rem;
      margin: 0.35rem 0 0.75rem;
      line-height: 1.6;
    }

    .params {
      display: grid;
      grid-template-columns: auto auto 1fr;
      gap: 0 1.25rem;
      font-size: 0.82rem;
      align-items: baseline;
    }

    .pn {
      font-family: var(--mono);
      color: var(--accent);
      padding: 0.3rem 0;
    }

    .pt {
      font-family: var(--mono);
      color: var(--muted);
      padding: 0.3rem 0;
    }

    .pd {
      color: #777;
      padding: 0.3rem 0;
      border-bottom: 1px solid #151515;
    }

    /* ── tables ───────────────────────────────── */

    .table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      margin: 0.75rem 0;
    }

    th, td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }

    th {
      color: var(--muted);
      font-weight: 400;
      font-size: 0.8rem;
    }

    td { color: #888; }

    /* ── footer ───────────────────────────────── */

    .foot {
      margin-top: 4rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-family: var(--mono);
      font-size: 0.75rem;
      color: var(--dim);
    }

    .foot a { color: var(--muted); }
    .foot a:hover { color: var(--accent); }

    /* ── responsive ───────────────────────────── */

    @media (max-width: 600px) {
      body { padding: 0 1rem; }
      .wrap { padding: 2.5rem 0 2rem; }
      h2 { margin-top: 2.5rem; }
      pre { padding: 0.85rem 1rem; font-size: 0.75rem; }

      .params {
        grid-template-columns: 1fr;
        gap: 0;
      }

      .params .pn {
        padding-bottom: 0;
        margin-top: 0.6rem;
      }

      .params .pn:first-child { margin-top: 0; }

      .params .pt {
        padding: 0;
        font-size: 0.72rem;
      }

      .params .pd {
        padding-top: 0.1rem;
        padding-bottom: 0.6rem;
      }
    }
  </style>
</head>
<body>
<div class="wrap">

  <header class="hero">
    <span class="tag">mcp server · free tier</span>
    <h1>syenite</h1>
    <p class="lead">Cross-protocol BTC lending rates, position monitoring, and risk assessment for AI agents. Aave v3 + Morpho Blue on Ethereum mainnet.</p>
  </header>

  <section>
    <h2>quick start</h2>

    <h3>Claude Desktop / Cursor</h3>
    <pre><code>{
  <span class="k">"mcpServers"</span>: {
    <span class="k">"syenite-lending"</span>: {
      <span class="k">"url"</span>: <span class="s">"YOUR_SERVER_URL/mcp"</span>,
      <span class="k">"headers"</span>: {
        <span class="k">"Authorization"</span>: <span class="s">"Bearer YOUR_API_KEY"</span>
      }
    }
  }
}</code></pre>

    <h3>cURL</h3>
    <pre><code><span class="prompt">$ </span>curl -X POST YOUR_SERVER_URL/mcp \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -H <span class="s">"Authorization: Bearer YOUR_API_KEY"</span> \\
  -d '{
    <span class="k">"jsonrpc"</span>: <span class="s">"2.0"</span>,
    <span class="k">"method"</span>: <span class="s">"tools/list"</span>,
    <span class="k">"id"</span>: 1
  }'</code></pre>
  </section>

  <section>
    <h2>tools</h2>

    <div class="tool">
      <div class="tool-name">lending.rates.query</div>
      <p class="tool-desc">Real-time BTC lending rates across Aave v3 and Morpho Blue. Compare borrow APY, supply APY, liquidity, and utilization across protocols and BTC wrappers.</p>
      <div class="params">
        <span class="pn">collateral</span><span class="pt">string</span><span class="pd">"wBTC", "tBTC", "cbBTC", or "all"</span>
        <span class="pn">borrowAsset</span><span class="pt">string</span><span class="pd">"USDC", "USDT", or "DAI"</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.market.overview</div>
      <p class="tool-desc">Aggregate view of BTC lending markets. Protocol-level totals for TVL, utilization, rate ranges, and available liquidity.</p>
      <div class="params">
        <span class="pn">collateral</span><span class="pt">string</span><span class="pd">"wBTC", "tBTC", "cbBTC", or "all"</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.position.monitor</div>
      <p class="tool-desc">Health check for any existing BTC lending position. Returns LTV, health factor, liquidation price, distance to liquidation, and estimated annual cost.</p>
      <div class="params">
        <span class="pn">address</span><span class="pt">string</span><span class="pd">Ethereum address to check</span>
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"aave-v3", "morpho", or "all"</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.risk.assess</div>
      <p class="tool-desc">Risk assessment for a proposed lending position. Returns risk score, recommended protocol, liquidation analysis, wrapper risk, and whether auto-unwind protection is recommended.</p>
      <div class="params">
        <span class="pn">collateral</span><span class="pt">string</span><span class="pd">"wBTC", "tBTC", or "cbBTC"</span>
        <span class="pn">collateralAmount</span><span class="pt">number</span><span class="pd">Amount in BTC</span>
        <span class="pn">borrowAsset</span><span class="pt">string</span><span class="pd">"USDC", "USDT", or "DAI"</span>
        <span class="pn">targetLTV</span><span class="pt">number</span><span class="pd">Desired LTV (1\u201399)</span>
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"aave-v3", "morpho", or "best"</span>
      </div>
    </div>
  </section>

  <section>
    <h2>api key</h2>
    <p>All tools are free. An API key is required for rate limiting and usage tracking. Contact the Syenite team or check the <a href="https://github.com">GitHub repo</a> for key request instructions.</p>
  </section>

  <section>
    <h2>data sources</h2>
    <p>All data is read directly from on-chain contracts via Ethereum RPC \u2014 no intermediary APIs or off-chain oracles. Rates and positions are real-time. Prices use Chainlink feeds. Data is cached briefly (15\u201360s) for performance.</p>
    <div class="table-wrap">
      <table>
        <tr><th>Protocol</th><th>Contracts</th><th>Markets</th></tr>
        <tr><td>Aave v3</td><td>Pool, PoolDataProvider</td><td>wBTC, tBTC, cbBTC</td></tr>
        <tr><td>Morpho Blue</td><td>Morpho, AdaptiveCurveIRM</td><td>wBTC/USDC, tBTC/USDC, cbBTC/USDC</td></tr>
        <tr><td>Chainlink</td><td>Price Feeds</td><td>BTC/USD, ETH/USD, USDC/USD</td></tr>
      </table>
    </div>
  </section>

  <footer class="foot">
    syenite \u00b7 institutional btc lending infrastructure \u00b7 <a href="https://github.com">github</a>
  </footer>

</div>
</body>
</html>`;
}
