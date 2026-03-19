# Web3 MCP Hub (confluxnet/mcp-hub) — Submission

The [Web3 MCP Hub](https://github.com/confluxnet/mcp-hub) (“MCP Agent Hub for Web3”) is an all-in-one gateway to explore, filter, and integrate **Web3** MCP tools. It uses **Saga DAO** for listing approval and a **pay-as-you-go / monetization** model. Submission is **in-app only** (no GitHub PR or static form).

## How to submit

There is **no submit-by-PR** or public form. You submit through the **live app** as an **Agent Builder**:

1. **Open the app**  
   **[mcp-hub-topaz.vercel.app](https://mcp-hub-topaz.vercel.app/)** (live demo from the repo).

2. **Connect a Web3 wallet**  
   Required to use “Submit MCP” / Provider flow.

3. **Go to “Submit MCP” or “Provider Dashboard”**  
   In the app nav, find the section for **Agent Builders** (e.g. “Submit MCP” or “Provide” — the repo has `pages/marketplace/provide.tsx`).

4. **Import your agent definition**  
   They mention “Import your agent's definition (e.g., **OpenAPI JSON**)”. For MCP you may need to provide:
   - Your MCP endpoint URL: **https://syenite.ai/mcp**
   - Or a description of tools/capabilities (swap, bridge, yield, lending). If they support MCP server URL or `.well-known/mcp.json`, use **https://syenite.ai** so they can discover **https://syenite.ai/.well-known/mcp.json**.

5. **Fill in details**  
   Name, description, price (if they enable monetization), etc. Suggested:
   - **Name:** Syenite  
   - **Description:** DeFi interface for AI agents — swap routing, bridge execution, yield intelligence, lending rates, and risk assessment via MCP. 30+ chains.  
   - **URL / endpoint:** https://syenite.ai/mcp or https://syenite.ai  

6. **Submit for DAO approval**  
   Listings go to **Saga DAO** for a community vote. After approval, the agent appears in the marketplace and you can monitor usage/earnings in the dashboard.

## Demo / status

The project was built for **BuidlAI Hackathon 2025**. The Vercel app may be a **demo**; if the app or DAO isn’t fully live, you may need to:

- Open an **issue** or **discussion** on [github.com/confluxnet/mcp-hub](https://github.com/confluxnet/mcp-hub) asking how to list Syenite (e.g. “We’d like to add our MCP server Syenite (https://syenite.ai) to the Web3 MCP Hub; is the Submit MCP flow on the live app the right path, or is there another process?”).
- Or contact the team (Conflux / wryta) via the links in the repo README.

## Reference

- **Repo:** [github.com/confluxnet/mcp-hub](https://github.com/confluxnet/mcp-hub)
- **Live app:** [mcp-hub-topaz.vercel.app](https://mcp-hub-topaz.vercel.app/)
- **Agent Builder flow (submit):** [YouTube – Agent Builder Flow](https://youtu.be/ILxILEeikMY)
- **DAO approval:** Listings are approved by Saga DAO; no direct “add and it’s live” path.

## Summary

| Question | Answer |
|----------|--------|
| Submit via GitHub PR? | No. |
| Submit via web form? | No; in-app only. |
| Action required? | Yes: use the live app (Submit MCP / Provider), or ask in repo issues/discussion. |
| Prerequisites | Web3 wallet; agent definition (URL or OpenAPI-like); DAO approval after submit. |
