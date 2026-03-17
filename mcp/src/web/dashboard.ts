import type { UsageStats } from "../logging/usage.js";

export function dashboardHtml(stats: UsageStats): string {
  const toolRows = stats.byTool
    .map(
      (t) =>
        `<tr><td><code>${t.tool}</code></td><td>${t.count.toLocaleString()}</td></tr>`
    )
    .join("");

  const userRows = stats.topUsers
    .map(
      (u) =>
        `<tr><td><code>${u.key.slice(0, 12)}\u2026</code></td><td>${u.count.toLocaleString()}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>syenite \u2014 dashboard</title>
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
      max-width: 780px;
      margin: 0 auto;
      padding: 3rem 0 2.5rem;
    }

    h1 {
      font-family: var(--mono);
      font-size: clamp(1.4rem, 4vw, 1.75rem);
      font-weight: 500;
      color: var(--heading);
      letter-spacing: -0.02em;
      margin-bottom: 2rem;
    }

    h1 .sub {
      color: var(--muted);
      font-weight: 400;
    }

    h2 {
      font-family: var(--mono);
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--muted);
      text-transform: lowercase;
      letter-spacing: 0.1em;
      margin: 2.5rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    /* ── stats grid ──────────────────────────── */

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      border-radius: 4px;
      overflow: hidden;
    }

    .stat {
      background: var(--surface);
      padding: 1.25rem;
    }

    .stat-label {
      font-family: var(--mono);
      font-size: 0.7rem;
      color: var(--muted);
      text-transform: lowercase;
      letter-spacing: 0.08em;
    }

    .stat-value {
      font-family: var(--mono);
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--heading);
      margin-top: 0.25rem;
    }

    .stat-unit {
      font-size: 0.7em;
      font-weight: 400;
      color: var(--muted);
    }

    /* ── chart ────────────────────────────────── */

    .chart {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1.25rem;
      margin-top: 1rem;
    }

    .bars {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 100px;
    }

    .bar {
      background: var(--accent);
      opacity: 0.5;
      border-radius: 1px 1px 0 0;
      min-width: 6px;
      flex: 1;
      position: relative;
      transition: opacity 0.15s;
    }

    .bar:hover { opacity: 0.9; }

    .bar-label {
      position: absolute;
      bottom: -18px;
      left: 50%;
      transform: translateX(-50%);
      font-family: var(--mono);
      font-size: 0.55rem;
      color: var(--dim);
      white-space: nowrap;
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
    }

    th, td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }

    th {
      color: var(--muted);
      font-weight: 400;
      font-size: 0.78rem;
      font-family: var(--mono);
    }

    td { color: #888; }

    code {
      font-family: var(--mono);
      font-size: 0.85em;
      color: var(--accent);
    }

    /* ── footer ───────────────────────────────── */

    .foot {
      margin-top: 3rem;
      font-family: var(--mono);
      font-size: 0.72rem;
      color: var(--dim);
    }

    /* ── responsive ───────────────────────────── */

    @media (max-width: 600px) {
      body { padding: 0 1rem; }
      .wrap { padding: 2rem 0 1.5rem; }
      .grid { grid-template-columns: repeat(2, 1fr); }
      .stat { padding: 1rem; }
      .stat-value { font-size: 1.25rem; }
      .bars { height: 70px; }
    }

    @media (max-width: 380px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
<div class="wrap">

  <h1>syenite <span class="sub">dashboard</span></h1>

  <div class="grid">
    <div class="stat">
      <div class="stat-label">total calls</div>
      <div class="stat-value">${stats.totalCalls.toLocaleString()}</div>
    </div>
    <div class="stat">
      <div class="stat-label">today</div>
      <div class="stat-value">${stats.todayCalls.toLocaleString()}</div>
    </div>
    <div class="stat">
      <div class="stat-label">this week</div>
      <div class="stat-value">${stats.weekCalls.toLocaleString()}</div>
    </div>
    <div class="stat">
      <div class="stat-label">unique clients</div>
      <div class="stat-value">${stats.uniqueClients}</div>
    </div>
    <div class="stat">
      <div class="stat-label">avg response</div>
      <div class="stat-value">${stats.avgResponseMs}<span class="stat-unit">ms</span></div>
    </div>
    <div class="stat">
      <div class="stat-label">error rate</div>
      <div class="stat-value">${stats.errorRate}<span class="stat-unit">%</span></div>
    </div>
  </div>

  ${
    stats.recentHours.length > 0
      ? `
  <h2>calls \u00b7 last 24h</h2>
  <div class="chart">
    <div class="bars">
      ${stats.recentHours
        .map((h) => {
          const maxCount = Math.max(...stats.recentHours.map((x) => x.count), 1);
          const height = Math.max((h.count / maxCount) * 100, 2);
          const label = h.hour.split(" ")[1] ?? "";
          return `<div class="bar" style="height:${height}%" title="${label}: ${h.count} calls"><span class="bar-label">${label}</span></div>`;
        })
        .join("")}
    </div>
  </div>`
      : ""
  }

  <h2>by tool</h2>
  <div class="table-wrap">
    <table>
      <tr><th>tool</th><th>calls</th></tr>
      ${toolRows || '<tr><td colspan="2" style="color:var(--muted)">no data yet</td></tr>'}
    </table>
  </div>

  <h2>top users</h2>
  <div class="table-wrap">
    <table>
      <tr><th>api key</th><th>calls</th></tr>
      ${userRows || '<tr><td colspan="2" style="color:var(--muted)">no data yet</td></tr>'}
    </table>
  </div>

  <p class="foot">refresh to update \u00b7 data from sqlite</p>

</div>
</body>
</html>`;
}
