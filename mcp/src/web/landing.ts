const GOOGLE_SITE_VERIFICATION = (process.env.GOOGLE_SITE_VERIFICATION ?? "").trim();

export function landingPageHtml(): string {
  const gscMeta = GOOGLE_SITE_VERIFICATION
    ? `\n  <meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION.replace(/"/g, "&quot;")}">`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">${gscMeta}
  <title>syenite — the DeFi interface for AI agents</title>
  <meta name="description" content="DeFi MCP for AI agents: swaps and bridges (30+ chains), yield and lending with execution (supply, borrow, withdraw, repay), prediction markets, carry screening, wallet balances, gas estimates, tx.verify, tx.simulate, and tx.receipt. Open access, no API key.">
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
  <link rel="canonical" href="https://syenite.ai/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Syenite">
  <meta property="og:title" content="syenite — the DeFi interface for AI agents">
  <meta property="og:description" content="One MCP endpoint for agentic DeFi: swap, bridge, yield, lending execution, prediction markets, alerts, and a trust layer across 30+ chains. No API key.">
  <meta property="og:url" content="https://syenite.ai/">
  <meta property="og:image" content="https://syenite.ai/assets/icon-square.png">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="syenite — the DeFi interface for AI agents">
  <meta name="twitter:description" content="One MCP endpoint for agentic DeFi: swap, bridge, yield, lending execution, prediction markets, alerts, and a trust layer across 30+ chains. No API key.">
  <meta name="twitter:image" content="https://syenite.ai/assets/icon-square.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icon-32.png">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Syenite",
    alternateName: "Syenite MCP",
    url: "https://syenite.ai/",
    description:
      "MCP server for agentic DeFi: swap and bridge routing, yield and multi-chain lending intelligence with execution, prediction market data and signals, carry screening, position alerts, wallet and gas tools, and a trust layer (tx.verify, tx.simulate, tx.guard, tx.receipt) across 30+ chains.",
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Model Context Protocol server",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Swap and bridge routing via Li.Fi",
      "Multi-chain lending execution (Aave, Morpho, Spark)",
      "Yield intelligence across lending, staking, vaults, savings rate",
      "Polymarket prediction market data and signals",
      "Carry trade screening and strategy search",
      "Position alerts with webhook delivery",
      "Wallet balances and gas estimation",
      "Transaction trust layer: verify, simulate, guard, receipt",
    ],
    author: { "@type": "Organization", name: "Syenite", url: "https://syenite.ai/" },
  })}</script>
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

    .hero { margin-bottom: 0.5rem; }

    .hero-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .hero-head .logo {
      width: 32px;
      height: 32px;
      display: block;
      flex-shrink: 0;
    }

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

    .callout {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1rem 1.25rem;
      margin: 1rem 0 1.5rem;
      font-size: 0.88rem;
      line-height: 1.6;
      color: #777;
    }

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

    .section-label {
      margin-top: 2rem;
      color: var(--muted);
      text-transform: uppercase;
      font-family: var(--mono);
      font-size: 0.72rem;
      letter-spacing: 0.08em;
    }

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
    <span class="tag">the defi interface for ai agents \u00b7 open access \u00b7 no api key</span>
    <div class="hero-head">
      <img src="/assets/icon-32.png" alt="" class="logo" width="32" height="32">
      <h1>syenite</h1>
    </div>
    <p class="lead">One MCP endpoint for swaps and bridges (30+ chains), yield, multi-chain lending with execution (supply, borrow, withdraw, repay), prediction markets, carry and strategy search, position alerts with webhooks, and a trust layer: verify contracts, simulate before sign, confirm with tx.receipt after. Syenite never holds keys \u2014 you get unsigned transactions and independent checks.</p>
    <p style="margin-top:1rem"><a href="/docs">Docs</a></p>
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
      <p class="tool-desc">Service info, full tool list, supported chains, and how to get started.</p>
    </div>

    <p class="section-label">wallet & gas</p>

    <div class="tool">
      <div class="tool-name">wallet.balances</div>
      <p class="tool-desc">Native and stablecoin balances for any EVM address on Ethereum, Arbitrum, Base, and BNB Chain. Check funds before you transact.</p>
      <div class="params">
        <span class="pn">address</span><span class="pt">string</span><span class="pd">Wallet to check</span>
        <span class="pn">chains</span><span class="pt">array</span><span class="pd">Optional: ethereum, arbitrum, base, bsc (defaults to all four)</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">gas.estimate</div>
      <p class="tool-desc">Current gas prices and estimated costs for common operations (swap, bridge, approve, contract register, and more).</p>
      <div class="params">
        <span class="pn">chains</span><span class="pt">array</span><span class="pd">Optional chain filter</span>
        <span class="pn">operations</span><span class="pt">array</span><span class="pd">Optional: transfer, swap, bridge, lending_supply, contract_register, etc.</span>
      </div>
    </div>

    <p class="section-label">swap & bridge</p>

    <div class="tool">
      <div class="tool-name">swap.quote</div>
      <p class="tool-desc">Get an optimal swap or bridge quote with unsigned transaction calldata. Same-chain swaps and cross-chain bridges via aggregated routing (1inch, 0x, Paraswap, and more). 30+ chains.</p>
      <div class="params">
        <span class="pn">fromToken</span><span class="pt">string</span><span class="pd">Token to sell \u2014 symbol or address</span>
        <span class="pn">toToken</span><span class="pt">string</span><span class="pd">Token to buy \u2014 symbol or address</span>
        <span class="pn">fromAmount</span><span class="pt">string</span><span class="pd">Amount in smallest unit (e.g. 1000000 for 1 USDC)</span>
        <span class="pn">fromAddress</span><span class="pt">string</span><span class="pd">Sender wallet address</span>
        <span class="pn">fromChain</span><span class="pt">string</span><span class="pd">"ethereum", "arbitrum", "base", "optimism", "polygon", etc.</span>
        <span class="pn">toChain</span><span class="pt">string</span><span class="pd">Destination chain (defaults to fromChain)</span>
        <span class="pn">slippage</span><span class="pt">number</span><span class="pd">Max slippage as decimal (0.005 = 0.5%)</span>
        <span class="pn">order</span><span class="pt">string</span><span class="pd">"CHEAPEST" or "FASTEST"</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">swap.multi</div>
      <p class="tool-desc">Batch multiple swap or bridge quotes in parallel. Compare routes or split liquidity across chains.</p>
      <div class="params">
        <span class="pn">requests</span><span class="pt">array</span><span class="pd">1\u201310 items, each same shape as swap.quote (fromToken, toToken, fromAmount, fromAddress, chains, slippage, order)</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">swap.status</div>
      <p class="tool-desc">Track execution status of a cross-chain bridge. Returns status, receiving tx hash, and amount received.</p>
      <div class="params">
        <span class="pn">txHash</span><span class="pt">string</span><span class="pd">Transaction hash of the submitted swap/bridge</span>
        <span class="pn">fromChain</span><span class="pt">string</span><span class="pd">Chain where tx was submitted</span>
        <span class="pn">toChain</span><span class="pt">string</span><span class="pd">Destination chain</span>
      </div>
    </div>

    <p class="section-label">trust layer</p>

    <div class="tool">
      <div class="tool-name">tx.verify</div>
      <p class="tool-desc">Check the callee against Etherscan, Sourcify, and Syenite\u2019s protocol registry. Risk flags for unverified contracts, proxies, and EOAs. Optional calldata decode via function selector.</p>
      <div class="params">
        <span class="pn">to</span><span class="pt">string</span><span class="pd">Contract address</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base, bsc</span>
        <span class="pn">data</span><span class="pt">string</span><span class="pd">Optional calldata for selector decode</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">tx.simulate</div>
      <p class="tool-desc">Simulate an unsigned transaction with eth_call: success or revert, gas estimate, native value effects. Verifiable on any RPC for the same block.</p>
      <div class="params">
        <span class="pn">transaction</span><span class="pt">object</span><span class="pd">to, data, from, optional value, optional chainId</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">Optional override (defaults from tx)</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">tx.guard</div>
      <p class="tool-desc">Evaluate a transaction against your rules: max native value, allowlists, blocklists, gas cap, require Syenite registry match.</p>
      <div class="params">
        <span class="pn">transaction</span><span class="pt">object</span><span class="pd">to, optional data, value, gasLimit, chainId</span>
        <span class="pn">rules</span><span class="pt">object</span><span class="pd">maxValueNative, allowedContracts, blockedContracts, requireAllowlisted, maxGasLimit, etc.</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">tx.receipt</div>
      <p class="tool-desc">Fetch and decode a transaction receipt: confirmed or reverted, gas cost in native and USD, decoded event logs (Transfer, Approval, Aave supply/borrow, Uniswap swaps), token transfers, and explorer link. Use after submitting any transaction to close the execution loop.</p>
      <div class="params">
        <span class="pn">txHash</span><span class="pt">string</span><span class="pd">Transaction hash to look up</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base, bsc (or chain ID)</span>
      </div>
    </div>

    <p class="section-label">yield</p>

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

    <p class="section-label">strategy & prediction</p>

    <div class="tool">
      <div class="tool-name">strategy.carry.screen</div>
      <p class="tool-desc">Screen lending markets for positive carry (supply APY vs borrow APY). Ranks self-funding leveraged ideas.</p>
      <div class="params">
        <span class="pn">collateral</span><span class="pt">string</span><span class="pd">Asset, BTC/ETH category, or "all"</span>
        <span class="pn">borrowAsset</span><span class="pt">string</span><span class="pd">Default USDC</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base, all</span>
        <span class="pn">positionSizeUSD</span><span class="pt">number</span><span class="pd">For return estimates</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">find.strategy</div>
      <p class="tool-desc">Composable scan across yield, carry, gas, and optional prediction signals for an asset you want to deploy.</p>
      <div class="params">
        <span class="pn">asset</span><span class="pt">string</span><span class="pd">e.g. ETH, WETH, USDC, wBTC</span>
        <span class="pn">amount</span><span class="pt">number</span><span class="pd">USD notionally deployed</span>
        <span class="pn">riskTolerance</span><span class="pt">string</span><span class="pd">low, medium, high</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base, all</span>
        <span class="pn">includePrediction</span><span class="pt">boolean</span><span class="pd">Include prediction signals (default true)</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">prediction.trending</div>
      <p class="tool-desc">Top Polymarket events by volume: probabilities, liquidity, spread.</p>
      <div class="params">
        <span class="pn">limit</span><span class="pt">number</span><span class="pd">1\u201325 (default 10)</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">prediction.search</div>
      <p class="tool-desc">Search Polymarket by topic.</p>
      <div class="params">
        <span class="pn">query</span><span class="pt">string</span><span class="pd">Topic or keyword</span>
        <span class="pn">limit</span><span class="pt">number</span><span class="pd">Optional</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">prediction.book</div>
      <p class="tool-desc">Order book depth for a Polymarket outcome token (token id from trending or search).</p>
      <div class="params">
        <span class="pn">tokenId</span><span class="pt">string</span><span class="pd">Outcome token id</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">prediction.signals</div>
      <p class="tool-desc">Actionable signals: wide spreads, extreme probabilities, volume spikes, mispricing-style flags.</p>
      <div class="params">
        <span class="pn">minStrength</span><span class="pt">number</span><span class="pd">0\u2013100</span>
        <span class="pn">types</span><span class="pt">array</span><span class="pd">Optional filter: wide_spread, extreme_probability, high_volume, deep_liquidity, mispriced</span>
        <span class="pn">limit</span><span class="pt">number</span><span class="pd">Max signals (default 20)</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">prediction.market</div>
      <p class="tool-desc">Deep drill-down on a single Polymarket market: full odds history, liquidity depth, resolution criteria, and one-sided order flow.</p>
      <div class="params">
        <span class="pn">slug</span><span class="pt">string</span><span class="pd">Market slug (from prediction.trending or prediction.search)</span>
        <span class="pn">conditionId</span><span class="pt">string</span><span class="pd">Alternative: Polymarket condition ID</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">prediction.watch</div>
      <p class="tool-desc">Monitor a Polymarket market for configurable triggers: odds threshold, movement, liquidity drop, resolution approaching, or volume spike. Optional webhook for push alerts.</p>
      <div class="params">
        <span class="pn">slug</span><span class="pt">string</span><span class="pd">Market slug to monitor</span>
        <span class="pn">conditions</span><span class="pt">object</span><span class="pd">oddsThresholdPct, oddsMovePct, liquidityDropPct, resolutionApproachingHours, volumeSpikeMultiple</span>
        <span class="pn">webhookUrl</span><span class="pt">string</span><span class="pd">Optional HTTP(S) URL for push alerts</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">prediction.position</div>
      <p class="tool-desc">List an agent’s Polymarket positions: size, average entry, current value, PnL, and time-to-resolve.</p>
      <div class="params">
        <span class="pn">address</span><span class="pt">string</span><span class="pd">EVM address (Polygon) holding positions</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">prediction.quote</div>
      <p class="tool-desc">Size-aware buy/sell quote walking the CLOB book: fill price, slippage at size, available depth, and fee estimate.</p>
      <div class="params">
        <span class="pn">tokenId</span><span class="pt">string</span><span class="pd">Outcome token ID</span>
        <span class="pn">side</span><span class="pt">string</span><span class="pd">“buy” or “sell”</span>
        <span class="pn">outcome</span><span class="pt">string</span><span class="pd">“YES” or “NO”</span>
        <span class="pn">size</span><span class="pt">number</span><span class="pd">USDC notional</span>
      </div>
    </div>

  


    <p class="section-label">lending</p>

    <div class="tool">
      <div class="tool-name">lending.rates.query</div>
      <p class="tool-desc">Real-time borrow and supply rates across Aave v3, Morpho Blue, and Spark for any collateral type.</p>
      <div class="params">
        <span class="pn">collateral</span><span class="pt">string</span><span class="pd">"wBTC", "WETH", "wstETH", "BTC", "ETH", or "all"</span>
        <span class="pn">borrowAsset</span><span class="pt">string</span><span class="pd">"USDC", "USDT", "DAI", or "GHO"</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base, all</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.market.overview</div>
      <p class="tool-desc">Aggregate market view. Per-protocol TVL, utilization, rate ranges, and available liquidity.</p>
      <div class="params">
        <span class="pn">collateral</span><span class="pt">string</span><span class="pd">Filter by asset, category, or "all"</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base, all</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.position.monitor</div>
      <p class="tool-desc">Health check for any DeFi lending position. LTV, health factor, liquidation price, and estimated annual cost.</p>
      <div class="params">
        <span class="pn">address</span><span class="pt">string</span><span class="pd">EVM address to check</span>
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"aave-v3", "compound-v3", "morpho", "spark", or "all"</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base, all</span>
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

    <p class="section-label">lending execution</p>

    <div class="tool">
      <div class="tool-name">lending.supply</div>
      <p class="tool-desc">Generate unsigned calldata to supply (deposit) an asset into Aave v3 or Spark. Returns a <code>transactionRequest</code> plus the ERC-20 approval tx. Ethereum, Arbitrum, Base.</p>
      <div class="params">
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"aave-v3" or "spark"</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base</span>
        <span class="pn">asset</span><span class="pt">string</span><span class="pd">"USDC", "WETH", "wBTC", "tBTC", "DAI", etc.</span>
        <span class="pn">amount</span><span class="pt">string</span><span class="pd">Human-readable (e.g. "1000" for 1000 USDC)</span>
        <span class="pn">onBehalfOf</span><span class="pt">string</span><span class="pd">Address that receives the aToken</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.borrow</div>
      <p class="tool-desc">Generate unsigned calldata to borrow against deposited collateral. Variable rate. Check <code>lending.risk.assess</code> first.</p>
      <div class="params">
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"aave-v3" or "spark"</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base</span>
        <span class="pn">asset</span><span class="pt">string</span><span class="pd">"USDC", "USDT", "DAI", "GHO"</span>
        <span class="pn">amount</span><span class="pt">string</span><span class="pd">Borrow amount in human-readable units</span>
        <span class="pn">onBehalfOf</span><span class="pt">string</span><span class="pd">Address with collateral deposited</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.withdraw</div>
      <p class="tool-desc">Generate unsigned calldata to withdraw a supplied asset. Use "max" to withdraw everything.</p>
      <div class="params">
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"aave-v3" or "spark"</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base</span>
        <span class="pn">asset</span><span class="pt">string</span><span class="pd">Asset to withdraw</span>
        <span class="pn">amount</span><span class="pt">string</span><span class="pd">Amount or "max"</span>
        <span class="pn">to</span><span class="pt">string</span><span class="pd">Recipient address</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">lending.repay</div>
      <p class="tool-desc">Generate unsigned calldata to repay debt. Use "max" for full repayment. Includes the ERC-20 approval tx.</p>
      <div class="params">
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">"aave-v3" or "spark"</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, arbitrum, base</span>
        <span class="pn">asset</span><span class="pt">string</span><span class="pd">Asset to repay</span>
        <span class="pn">amount</span><span class="pt">string</span><span class="pd">Amount or "max" for full repayment</span>
        <span class="pn">onBehalfOf</span><span class="pt">string</span><span class="pd">Address whose debt to repay</span>
      </div>
    </div>


    <p class="section-label">metamorpho vaults</p>

    <div class="tool">
      <div class="tool-name">metamorpho.supply</div>
      <p class="tool-desc">Generate unsigned ERC-4626 deposit calldata for a MetaMorpho vault (Steakhouse, Gauntlet, and others). Returns a <code>transactionRequest</code> plus the ERC-20 approval tx. Ethereum, Base, Arbitrum, Optimism.</p>
      <div class="params">
        <span class="pn">vault</span><span class="pt">string</span><span class="pd">Vault address or name fragment (e.g. "Steakhouse USDC")</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, base, arbitrum, optimism</span>
        <span class="pn">amount</span><span class="pt">string</span><span class="pd">Human-readable amount (e.g. "1000")</span>
        <span class="pn">receiver</span><span class="pt">string</span><span class="pd">Address that receives the vault shares</span>
      </div>
    </div>

    <div class="tool">
      <div class="tool-name">metamorpho.withdraw</div>
      <p class="tool-desc">Generate unsigned ERC-4626 redeem calldata to withdraw from a MetaMorpho vault. Use "max" to redeem all shares.</p>
      <div class="params">
        <span class="pn">vault</span><span class="pt">string</span><span class="pd">Vault address or name fragment</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">ethereum, base, arbitrum, optimism</span>
        <span class="pn">amount</span><span class="pt">string</span><span class="pd">Amount or "max"</span>
        <span class="pn">receiver</span><span class="pt">string</span><span class="pd">Address that receives the underlying asset</span>
      </div>
    </div>

    <p class="section-label">prices</p>

    <div class="tool">
      <div class="tool-name">token.price</div>
      <p class="tool-desc">Current USD price for any supported token via Chainlink on-chain oracles. Same feeds used by Aave, Morpho, and Spark for liquidation triggers. Batch up to 20 tokens per call.</p>
      <div class="params">
        <span class="pn">symbol</span><span class="pt">string</span><span class="pd">Token symbol (e.g. wBTC, WETH, USDC)</span>
        <span class="pn">symbols</span><span class="pt">string[]</span><span class="pd">Optional batch: array of symbols</span>
      </div>
    </div>

    <p class="section-label">alerts</p>

    <div class="tool">
      <div class="tool-name">alerts.watch</div>
      <p class="tool-desc">Register an address for health-factor monitoring. Poll <code>alerts.check</code> for warnings, or provide a <code>webhookUrl</code> to receive alerts as POST requests in real-time. Use <code>alerts.list</code> and <code>alerts.remove</code> to manage watches.</p>
      <div class="params">
        <span class="pn">address</span><span class="pt">string</span><span class="pd">Position owner</span>
        <span class="pn">protocol</span><span class="pt">string</span><span class="pd">Optional protocol filter</span>
        <span class="pn">chain</span><span class="pt">string</span><span class="pd">Optional chain</span>
        <span class="pn">healthFactorThreshold</span><span class="pt">number</span><span class="pd">Alert below this (default 1.5)</span>
        <span class="pn">webhookUrl</span><span class="pt">string</span><span class="pd">Optional HTTP(S) URL for push alerts. Structured JSON payload with retries.</span>
      </div>
    </div>
  </section>

  <section>
    <h2>how execution works</h2>
    <div class="callout">
      <strong>Syenite never holds private keys.</strong> <code>swap.quote</code>, <code>lending.supply</code>, <code>lending.borrow</code>, <code>lending.withdraw</code>, and <code>lending.repay</code> all return unsigned <code>transactionRequest</code> objects. Before signing, use <code>tx.verify</code>, <code>tx.simulate</code>, and <code>tx.guard</code>. After signing and submitting, confirm with <code>tx.receipt</code>. For cross-chain bridges, track with <code>swap.status</code>. <a href="/docs/tx-trust-layer">Trust layer: verify, simulate, guard, receipt</a> \u00b7 <a href="/docs/lending-execution">Lending execution guide</a>
    </div>
    <p>Routing is aggregated across 1inch, 0x, Paraswap, and bridge protocols via Li.Fi. Quotes are optimised for best price or fastest execution.</p>
  </section>

  <section>
    <h2>supported chains</h2>
    <p>Swap and bridge routing supports 30+ chains including Ethereum, Arbitrum, Optimism, Base, Polygon, BSC, Avalanche, zkSync, Linea, Scroll, Gnosis, and Fantom.</p>
    <p>Lending rates, market overview, and position monitoring: Ethereum, Arbitrum, Base (EVM) + Solana (Kamino, MarginFi). MetaMorpho vaults: Ethereum, Base, Arbitrum, Optimism. Wallet balances and gas: EVM + Solana. Yield intelligence covers EVM blue-chips plus Solana DeFi (Kamino, Drift, Jito, Marinade, Sanctum, Jupiter).</p>
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
        <tr><th>Protocol</th><th>Chains</th><th>Collateral</th></tr>
        <tr><td>Aave v3</td><td>Ethereum, Arbitrum, Base</td><td>wBTC, tBTC, cbBTC, WETH, wstETH, rETH, cbETH, weETH</td></tr>
        <tr><td>Morpho Blue</td><td>Ethereum, Base, Arbitrum, Optimism</td><td>wBTC, tBTC, cbBTC, wstETH, WETH</td></tr>
        <tr><td>Spark</td><td>Ethereum</td><td>wBTC, tBTC, WETH, wstETH, rETH, weETH</td></tr>
        <tr><td>Kamino</td><td>Solana</td><td>SOL, mSOL, jitoSOL, USDC, wBTC</td></tr>
        <tr><td>MarginFi</td><td>Solana</td><td>SOL, wBTC, USDC, wstETH</td></tr>
      </table>
    </div>
  </section>

  <section>
    <h2>access</h2>
    <p>Open access \u2014 no API key required. Rate limited to 30 requests/minute per IP. Just point your agent at the endpoint and start querying.</p>
  </section>

  <footer class="foot">
    syenite \u00b7 the defi interface for ai agents \u00b7 <a href="https://syenite.ai">syenite.ai</a> \u00b7 <a href="/docs">docs</a>${(process.env.AGENT_ID_BASE || process.env.AGENT_ID) ? ` \u00b7 <a href="https://basescan.org/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/${process.env.AGENT_ID_BASE || process.env.AGENT_ID}">ERC-8004 Agent</a>` : ""}
  </footer>

</div>
</body>
</html>`;
}
