# Testing Plan & Production Architecture

## Testing Required Before Going Live

### 1. Data Accuracy (Critical)

Verify that the on-chain data we return matches reality.

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Aave v3 borrow rate matches Aave UI | Compare `lending.rates.query` output against app.aave.com for wBTC/USDC | Within 0.05% APY |
| Morpho Blue rate matches Morpho UI | Compare against app.morpho.org for tBTC/USDC | Within 0.05% APY |
| BTC price matches Chainlink | Compare against data.chain.link BTC/USD feed | Exact match (same source) |
| Position monitor returns correct health factor | Use a known address with an active Aave/Morpho position | Health factor matches protocol UI |
| Risk assessment liquidation price is correct | Manually compute liquidation price for a test scenario | Match manual calculation |
| Available liquidity is accurate | Cross-reference with DeFiLlama or protocol UIs | Within 1% of reference |

**How to run:** Call each tool via curl or the MCP test script, compare against the protocol's own UI. Document discrepancies.

### 2. MCP Protocol Compliance

| Test | Method | Pass Criteria |
|------|--------|---------------|
| `tools/list` returns all 4 tools | POST to /mcp | All tools listed with descriptions and schemas |
| Tool call with valid params returns data | Call each tool with valid args | 200 response, valid JSON in content |
| Tool call with missing required params | Omit `address` from position.monitor | Proper error response, not crash |
| Tool call with invalid params | Pass `collateral: "INVALID"` | Graceful error message |
| Claude Desktop can connect and use tools | Add to Claude config, ask a lending question | Claude calls the tool and presents data |
| Cursor can connect and use tools | Add to Cursor MCP config | Same |

### 3. Auth & Rate Limiting

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Request without API key is rejected | Omit Authorization header | 401 response |
| Request with invalid key is rejected | Use `Bearer sk_invalid` | 401 response |
| Request with valid key succeeds | Generate key, use it | 200 response with data |
| Rate limit triggers at 100 req/min | Script that sends 101 requests | 101st returns 429 |
| Revoked key is rejected | Generate key, revoke it, use it | 401 response |

### 4. Resilience

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Server handles RPC timeout gracefully | Block Alchemy endpoint temporarily | Error response, not crash, server stays up |
| Server handles malformed JSON | Send garbage to /mcp | 400 error, server stays up |
| Server survives high concurrent load | 50 concurrent requests | All complete (maybe slower), no crashes |
| Health check reflects RPC issues | Set invalid Alchemy key | Health returns "degraded" |
| Cache works (second request is faster) | Time two consecutive identical requests | Second is <50ms (cache hit) |

### 5. Dashboard & Landing Page

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Landing page loads | GET / | 200, HTML with tool docs |
| Dashboard requires auth | GET /dashboard without Basic auth | 401 |
| Dashboard shows real usage | Make some tool calls, then check dashboard | Calls appear in metrics |
| Health endpoint returns valid JSON | GET /health | JSON with status, checks |

---

## Production vs. Test Droplet

### Current Setup (Test)

```
Droplet: 165.22.119.38
SSH: ~/.ssh/do_personal_syenite
OS: Ubuntu (standard DO image)
Deployment: rsync + systemd (manual)
SSL: None (HTTP only)
Domain: IP address only
Monitoring: None
Backups: None
```

### Production Setup (Recommended)

```
Platform: DigitalOcean App Platform (or Droplet with proper hardening)
Domain: mcp.syenite.xyz (or lending.syenite.xyz)
SSL: Managed TLS via DO App Platform or Let's Encrypt + nginx
Deployment: GitHub Actions → auto-deploy on push to main
Process: PM2 or systemd with auto-restart
Monitoring: DO built-in + health check alerts
Backups: SQLite DB backed up daily to DO Spaces
Logging: Structured JSON logs, retained 30 days
```

### What Changes for Production

| Concern | Test (Now) | Production |
|---------|------------|------------|
| **SSL/TLS** | HTTP only (fine for testing) | Required. MCP clients send API keys in headers. |
| **Domain** | IP address | Custom domain with DNS |
| **Process manager** | Manual `node dist/index.js` | systemd or PM2 with auto-restart on crash |
| **Deployment** | rsync from local | GitHub Actions: push → build → deploy |
| **Secrets** | .env file on server | DO App Platform env vars or encrypted secrets |
| **DB persistence** | SQLite on local disk | SQLite on persistent volume + daily backup |
| **Monitoring** | Manual `curl /health` | Automated health checks + alerts (UptimeRobot or DO) |
| **Rate limiting** | In-memory (resets on restart) | Same is fine for PoC scale |
| **Firewall** | Default DO | UFW: only 22, 80, 443 open |
| **Updates** | Manual SSH | Automated via CI/CD |

### Migration Path: Droplet → App Platform

For the PoC, the droplet is fine. When you want to go "production":

1. Create DO App Platform app pointing to your GitHub repo
2. Set the Dockerfile path to `mcp/Dockerfile`
3. Add env vars (ALCHEMY_API_KEY, ADMIN_PASSWORD, DATABASE_PATH=/data/syenite.db)
4. Attach a persistent volume at `/data`
5. Set custom domain + managed SSL
6. Enable auto-deploy from main branch

Cost: $5-7/mo (Basic tier). Zero ops after setup.

---

## Test Script

Quick smoke test you can run after deployment:

```bash
SERVER="http://165.22.119.38:3000"  # change to your URL

echo "=== Health ==="
curl -s $SERVER/health | python3 -m json.tool

echo -e "\n=== Landing Page ==="
curl -s -o /dev/null -w "%{http_code}" $SERVER/

echo -e "\n\n=== Tools List ==="
curl -s -X POST $SERVER/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' | head -c 200

echo -e "\n\n=== Rates Query ==="
curl -s -X POST $SERVER/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"lending.rates.query","arguments":{"collateral":"all"}},"id":2}' | grep 'data:' | head -1 | cut -c1-300

echo -e "\n\n=== Risk Assess ==="
curl -s -X POST $SERVER/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"lending.risk.assess","arguments":{"collateral":"wBTC","collateralAmount":1,"targetLTV":50}},"id":3}' | grep 'data:' | head -1 | cut -c1-300

echo -e "\n\nDone."
```
