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
        `<tr><td><code>${u.key.slice(0, 12)}...</code></td><td>${u.count.toLocaleString()}</td></tr>`
    )
    .join("");

  const hourLabels = stats.recentHours.map((h) => `"${h.hour.split(" ")[1]}"`).join(",");
  const hourData = stats.recentHours.map((h) => h.count).join(",");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Syenite Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #e0e0e0; background: #0a0a0f; }
    .container { max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem; }
    h1 { font-size: 1.8rem; color: #fff; margin-bottom: 2rem; }
    h1 span { color: #7c6cf0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: #111118; border: 1px solid #1a1a2e; border-radius: 8px; padding: 1.25rem; }
    .stat-label { color: #666; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 1.8rem; font-weight: 700; color: #fff; margin-top: 0.25rem; }
    .stat-sub { font-size: 0.85rem; color: #555; }
    h2 { font-size: 1.2rem; color: #ccc; margin: 2rem 0 1rem; }
    table { width: 100%; border-collapse: collapse; background: #111118; border: 1px solid #1a1a2e; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 0.6rem 1rem; border-bottom: 1px solid #1a1a2e; font-size: 0.9rem; }
    th { color: #666; font-weight: 500; background: #0d0d14; }
    code { font-family: 'SF Mono', monospace; color: #7c6cf0; }
    .chart-container { background: #111118; border: 1px solid #1a1a2e; border-radius: 8px; padding: 1.25rem; margin-bottom: 2rem; }
    .bar-chart { display: flex; align-items: flex-end; gap: 2px; height: 120px; }
    .bar { background: #7c6cf0; border-radius: 2px 2px 0 0; min-width: 8px; flex: 1; position: relative; }
    .bar:hover { background: #9d8ff0; }
    .bar-label { position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); font-size: 0.6rem; color: #555; white-space: nowrap; }
    .refresh { color: #555; font-size: 0.8rem; margin-top: 2rem; }
  </style>
</head>
<body>
<div class="container">
  <h1><span>Syenite</span> Dashboard</h1>

  <div class="grid">
    <div class="stat-card">
      <div class="stat-label">Total Calls</div>
      <div class="stat-value">${stats.totalCalls.toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Today</div>
      <div class="stat-value">${stats.todayCalls.toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">This Week</div>
      <div class="stat-value">${stats.weekCalls.toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Unique Keys</div>
      <div class="stat-value">${stats.uniqueKeys}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Response</div>
      <div class="stat-value">${stats.avgResponseMs}ms</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Error Rate</div>
      <div class="stat-value">${stats.errorRate}%</div>
    </div>
  </div>

  ${
    stats.recentHours.length > 0
      ? `
  <h2>Calls (Last 24h)</h2>
  <div class="chart-container">
    <div class="bar-chart">
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

  <h2>By Tool</h2>
  <table>
    <tr><th>Tool</th><th>Calls</th></tr>
    ${toolRows || '<tr><td colspan="2" style="color:#555">No data yet</td></tr>'}
  </table>

  <h2>Top Users</h2>
  <table>
    <tr><th>API Key</th><th>Calls</th></tr>
    ${userRows || '<tr><td colspan="2" style="color:#555">No data yet</td></tr>'}
  </table>

  <p class="refresh">Refresh the page to update. Data is live from SQLite.</p>
</div>
</body>
</html>`;
}
