export function landingPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>syenite — DeFi intelligence for AI agents</title>
  <meta name="description" content="DeFi intelligence for AI agents. Yield opportunities, lending rates, position monitoring, and risk assessment via MCP. On-chain data from blue-chip DeFi protocols on Ethereum.">
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
    <span class="tag">mcp server · open access · no api key required</span>
    <h1>syenite</h1>
    <p class="lead">DeFi intelligence for AI agents. Yield opportunities, lending rates, risk assessment, and position monitoring across blue-chip DeFi protocols on Ethereum \u2014 all from on-chain data.</p>
  </header>

  <section>
    <h2>quick start</h2>

    <h3>Claude Desktop / Cursor</h3>
    <pre><code>{
  <span class="k">"mcpServers"</span>: {
    <span class="k">"syenite"</span>: {
      <span class="k">"url"</span>: <span class="s">"https://syenite.ai/mcp"</span>
    }
  }
}</code></pre>

    <h3>cURL</h3>
    <pre><code><span class="prompt">$ </span>curl -X POST https://syenite.ai/mcp \\
  -H <span class="s">"Content-Type: application/json"</span> \\
  -H <span class="s">"Accept: application/json, text/event-stream"</span> \\
  -d '{
    <span class="k">"jsonrpc"</span>: <span class="s">"2.0"</span>,
    <span class="k">"method"</span>: <span class="s">"tools/list"</span>,
    <span class="k">"id"</span>: 1
  }'</code></pre>
    <p style="font-size:0.82rem;color:#555;margin-top:0.5rem">No API key needed. Just add the URL and start querying.</p>
  </section>

  <section>
    <h2>tools</h2>

    <div class="tool">
      <div class="tool-name">syenite.help</div>
      <p class="tool-desc">Service info, available tools, supported protocols, yield sources, and how to get started.</p>
    </div>

    <h3 style="margin-top:2rem;color:var(--muted);text-transform:uppercase;font-size:0.72rem;letter-spacing:0.08em">yield</h3>

    <div class="tool">
      <div class="tool-name">yield.opportunities</div>
      <p class="tool-desc">Find the best DeFi yield for any asset. Aggregates lending supply, liquid staking, vaults, savings rates, and basis capture across blue-chip protocols.</p>
      <div class="params">
        <span class="pn">asset</span><span class="pt">string</span><span class="pd">"ETH", "USDC", "DAI", "stables", or "all"</span>
        <span class="pn">category</span><span class="pt">string</span><span class="pd">"lending-supply", "liquid-staking", "vault", "savings-rate", "basis-capture", or "all"</span>
        <span class="pn">riskTolerance</span><span class="pt">string</span><span class="pd">"low", "medium", or "high" (default)</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">yield.assess</div>
      <p class="tool-desc">Deep risk assessment for a specific yield strategy. Smart contract risk, oracle dependency, governance, liquidity, depeg risk, position sizing, and comparable alternatives.</p>
      <div class="params">
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"Aave", "Lido", "Morpho", "Ethena", "Yearn", "Maker", etc.</span>
        <span class="pn">amount</span><span class="pt">number</span><span class="pd">USD amount to deposit (optional, enables sizing analysis)</span>
        <span class="pn">asset</span><span class="pt">string</span><span class="pd">Asset context for finding alternatives</span>
      </div>
    </div>

    <h3 style="margin-top:2rem;color:var(--muted);text-transform:uppercase;font-size:0.72rem;letter-spacing:0.08em">lending</h3>

    <div class="tool">
      <div class="tool-name">lending.rates.query</div>
      <p class="tool-desc">Real-time borrow and supply rates across Aave v3, Morpho Blue, and Spark for any collateral type.</p>
      <div class="params">
        <span class="pn">collateral</span><span class="pt">string</span><span class="pd">"wBTC", "WETH", "wstETH", "BTC", "ETH", or "all"</span>
        <span class="pn">borrowAsset</span><span class="pt">string</span><span class="pd">"USDC", "USDT", "DAI", or "GHO"</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.market.overview</div>
      <p class="tool-desc">Aggregate market view. Per-protocol TVL, utilization, rate ranges, and available liquidity.</p>
      <div class="params">
        <span class="pn">collateral</span><span class="pt">string</span><span class="pd">Filter by asset, category, or "all"</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.position.monitor</div>
      <p class="tool-desc">Health check for any DeFi lending position. LTV, health factor, liquidation price, and estimated annual cost.</p>
      <div class="params">
        <span class="pn">address</span><span class="pt">string</span><span class="pd">Ethereum address to check</span>
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"aave-v3", "morpho", "spark", or "all"</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.risk.assess</div>
      <p class="tool-desc">Risk assessment for a proposed lending position. Risk score, liquidation analysis, protocol risk, and position sizing.</p>
      <div class="params">
        <span class="pn">collateral</span><span class="pt">string</span><span class="pd">"wBTC", "tBTC", "cbBTC", "WETH", "wstETH", "rETH", "cbETH", "weETH"</span>
        <span class="pn">collateralAmount</span><span class="pt">number</span><span class="pd">Amount of collateral asset</span>
        <span class="pn">targetLTV</span><span class="pt">number</span><span class="pd">Desired LTV (1\u201399)</span>
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"aave-v3", "morpho", "spark", or "best"</span>
      </div>
    </div>
  </section>

  <section>
    <h2>access</h2>
    <p>Open access \u2014 no API key required. Rate limited to 30 requests/minute per IP. Just point your agent at the endpoint and start querying.</p>
  </section>

  <section>
    <h2>yield sources</h2>
    <div class="table-wrap">
      <table>
        <tr><th>Category</th><th>Protocols</th><th>Assets</th></tr>
        <tr><td>Lending Supply</td><td>Aave v3, Morpho Blue, Spark</td><td>USDC, USDT, DAI, GHO</td></tr>
        <tr><td>Liquid Staking</td><td>Lido, Rocket Pool, Coinbase</td><td>ETH \u2192 stETH, rETH, cbETH</td></tr>
        <tr><td>Savings Rate</td><td>Maker DSR</td><td>DAI \u2192 sDAI</td></tr>
        <tr><td>Vaults</td><td>MetaMorpho, Yearn v3</td><td>USDC, USDT, WETH</td></tr>
        <tr><td>Basis Capture</td><td>Ethena</td><td>USDe \u2192 sUSDe</td></tr>
      </table>
    </div>
  </section>

  <section>
    <h2>lending protocols</h2>
    <p>All lending data read directly from on-chain contracts via Ethereum RPC. Prices use Chainlink feeds. Cached briefly (15\u201360s).</p>
    <div class="table-wrap">
      <table>
        <tr><th>Protocol</th><th>Collateral</th></tr>
        <tr><td>Aave v3</td><td>wBTC, tBTC, cbBTC, WETH, wstETH, rETH, cbETH, weETH</td></tr>
        <tr><td>Morpho Blue</td><td>wBTC, tBTC, cbBTC, wstETH, WETH</td></tr>
        <tr><td>Spark</td><td>wBTC, tBTC, WETH, wstETH, rETH, weETH</td></tr>
      </table>
    </div>
  </section>

  <footer class="foot">
    syenite \u00b7 defi intelligence \u00b7 <a href="https://syenite.ai">syenite.ai</a>
  </footer>

</div>
</body>
</html>`;
}
