# MCP Directory Listings — Tracking

## Status Key

| Status | Meaning |
|--------|---------|
| `TODO` | Not yet submitted |
| `SUBMITTED` | Application/listing submitted, awaiting review |
| `LIVE` | Listed and discoverable |
| `REJECTED` | Submission rejected (see notes) |

---

## Directory Listings

| # | Directory | URL | Auth Required | Programmatic? | Status | Date | Notes |
|---|-----------|-----|---------------|---------------|--------|------|-------|
| 1 | **.well-known/mcp.json** | `https://SERVER_URL/.well-known/mcp.json` | None | Auto (deployed) | `TODO` | — | Already built into the server. Goes live when the server is deployed. |
| 2 | **npm** | [npmjs.com/@syenite/mcp-lending](https://npmjs.com/package/@syenite/mcp-lending) | npm account | `npm publish` | `TODO` | — | Requires `@syenite` org on npm or publish as unscoped. |
| 3 | **GitHub** | github.com/??? | GitHub account | `gh repo create` | `TODO` | — | Decide: separate repo or monorepo mcp/ directory. Separate is better for npm/discovery. |
| 4 | **MCP Registry (Official)** | [github.com/modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry) | GitHub OAuth | `mcp-publisher` CLI | `TODO` | — | Official Anthropic registry. Submit via CLI: `npx @anthropic-ai/mcp-publisher publish`. Requires GitHub OAuth. |
| 5 | **Smithery** | [smithery.ai](https://smithery.ai) | GitHub OAuth | REST API available | `TODO` | — | Submit via their web UI or API. Good discoverability. |
| 6 | **Glama** | [glama.ai/mcp](https://glama.ai/mcp) | None | Auto-indexes GitHub | `TODO` | — | Auto-discovers from GitHub if repo has correct tags (`mcp`, `mcp-server`). Ensure topics are set. |
| 7 | **mcp.so** | [mcp.so](https://mcp.so) | Email | Web form | `TODO` | — | Community directory. Manual submission via web form. |
| 8 | **PulseMCP** | [pulsemcp.com](https://pulsemcp.com) | Email | Web form | `TODO` | — | Growing directory with analytics. |
| 9 | **MCP Hub** | [mcphub.io](https://mcphub.io) | GitHub | Web form | `TODO` | — | Curated directory. |

---

## Programmatic Submission Summary

**Fully automatable:**
- `.well-known/mcp.json` — already deployed with the server
- `npm publish` — single command
- GitHub repo creation — `gh repo create`
- Glama — auto-indexes from GitHub, just needs correct repo topics

**Semi-automatable (requires one-time OAuth/login, then CLI):**
- Official MCP Registry — `mcp-publisher` CLI after GitHub OAuth
- Smithery — has an API after initial auth

**Manual (web form only):**
- mcp.so — web submission form
- PulseMCP — web submission form
- MCP Hub — web submission form

**Estimated total time for manual steps:** ~20 minutes (one-time)

---

## Submission Order

1. `.well-known/mcp.json` — ships with deploy (free)
2. GitHub public repo — needed for everything else
3. npm publish — enables self-hosting path
4. Official MCP Registry — highest authority signal
5. Glama — auto-indexes from GitHub (free)
6. Smithery — good discovery, has API
7. mcp.so, PulseMCP, MCP Hub — manual submissions (batch)

---

## GitHub Repo Setup Checklist

When creating the public repo:

- [ ] Repository name: `syenite-mcp-lending` or `mcp-lending`
- [ ] Description: "DeFi lending intelligence for AI agents — BTC rates, position monitoring, risk assessment via MCP"
- [ ] Topics: `mcp`, `mcp-server`, `defi`, `lending`, `bitcoin`, `aave`, `morpho`, `ethereum`
- [ ] MIT License
- [ ] Include README with tool documentation
- [ ] Include `.well-known/mcp.json` reference
- [ ] Include example configs for Claude Desktop, Cursor

---

## Post-Listing Monitoring

Track weekly:
- npm download count (`npm info @syenite/mcp-lending` or npm stats page)
- GitHub stars / forks / issues
- API key requests (from dashboard)
- Inbound mentions (search "syenite" on Twitter/X, Discord channels)
