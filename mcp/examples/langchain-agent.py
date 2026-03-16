"""
Syenite MCP Lending — LangChain Example

Wraps Syenite's MCP tools as LangChain tools for use with any LangChain agent.

Usage:
    pip install langchain langchain-openai httpx
    export OPENAI_API_KEY=sk-...
    export SYENITE_API_KEY=sk_...
    python langchain-agent.py
"""

import os
import json
import httpx
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

SYENITE_URL = os.environ.get("SYENITE_URL", "http://localhost:3000/mcp")
SYENITE_KEY = os.environ.get("SYENITE_API_KEY", "")


def _call_mcp(tool_name: str, args: dict) -> dict:
    resp = httpx.post(
        SYENITE_URL,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {SYENITE_KEY}",
        },
        json={
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": args},
            "id": 1,
        },
        timeout=30,
    )
    for line in resp.text.split("\n"):
        if line.startswith("data: "):
            data = json.loads(line[6:])
            return json.loads(data["result"]["content"][0]["text"])
    return {"error": "No response"}


@tool
def get_btc_lending_rates(collateral: str = "all", borrow_asset: str = "USDC") -> str:
    """Get real-time BTC lending rates across Aave v3 and Morpho Blue on Ethereum.
    collateral: 'wBTC', 'tBTC', 'cbBTC', or 'all'
    borrow_asset: 'USDC', 'USDT', or 'DAI'"""
    return json.dumps(_call_mcp("lending.rates.query", {
        "collateral": collateral,
        "borrowAsset": borrow_asset,
    }), indent=2)


@tool
def get_market_overview(collateral: str = "all") -> str:
    """Get aggregate overview of BTC lending markets — TVL, utilization, rate ranges."""
    return json.dumps(_call_mcp("lending.market.overview", {
        "collateral": collateral,
    }), indent=2)


@tool
def monitor_position(address: str, protocol: str = "all") -> str:
    """Check health of a BTC lending position for any Ethereum address."""
    return json.dumps(_call_mcp("lending.position.monitor", {
        "address": address,
        "protocol": protocol,
    }), indent=2)


@tool
def assess_lending_risk(
    collateral: str,
    collateral_amount: float,
    target_ltv: float,
    borrow_asset: str = "USDC",
) -> str:
    """Assess risk of a proposed BTC lending position.
    collateral: 'wBTC', 'tBTC', or 'cbBTC'
    collateral_amount: BTC amount
    target_ltv: desired LTV percentage (1-99)"""
    return json.dumps(_call_mcp("lending.risk.assess", {
        "collateral": collateral,
        "collateralAmount": collateral_amount,
        "targetLTV": target_ltv,
        "borrowAsset": borrow_asset,
    }), indent=2)


if __name__ == "__main__":
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    tools_list = [get_btc_lending_rates, get_market_overview, monitor_position, assess_lending_risk]

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a DeFi lending analyst with access to real-time on-chain data. Use your tools to provide accurate, data-driven analysis."),
        ("human", "{input}"),
        ("placeholder", "{agent_scratchpad}"),
    ])

    agent = create_tool_calling_agent(llm, tools_list, prompt)
    executor = AgentExecutor(agent=agent, tools=tools_list, verbose=True)

    result = executor.invoke({
        "input": "Compare tBTC vs wBTC lending conditions. Which is better for borrowing 50k USDC with 1.5 BTC collateral?"
    })
    print(result["output"])
