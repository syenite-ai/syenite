"""
Syenite MCP Lending — OpenAI Agents SDK Example

A simple agent that uses Syenite's MCP tools to answer questions
about BTC lending markets.

Usage:
    pip install openai httpx
    export OPENAI_API_KEY=sk-...
    export SYENITE_API_KEY=sk_...
    python openai-agent.py
"""

import os
import json
import httpx
from openai import OpenAI

SYENITE_URL = os.environ.get("SYENITE_URL", "http://localhost:3000/mcp")
SYENITE_KEY = os.environ.get("SYENITE_API_KEY", "")

client = OpenAI()


def call_syenite(tool_name: str, args: dict) -> dict:
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
    return {"error": "No response from Syenite"}


tools = [
    {
        "type": "function",
        "function": {
            "name": "lending_rates_query",
            "description": "Get real-time BTC lending rates across Aave v3 and Morpho Blue",
            "parameters": {
                "type": "object",
                "properties": {
                    "collateral": {
                        "type": "string",
                        "enum": ["wBTC", "tBTC", "cbBTC", "all"],
                        "description": "BTC wrapper to query",
                    },
                    "borrowAsset": {
                        "type": "string",
                        "enum": ["USDC", "USDT", "DAI"],
                        "description": "Stablecoin to borrow",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lending_risk_assess",
            "description": "Assess risk of a proposed BTC lending position",
            "parameters": {
                "type": "object",
                "properties": {
                    "collateral": {"type": "string", "enum": ["wBTC", "tBTC", "cbBTC"]},
                    "collateralAmount": {"type": "number"},
                    "targetLTV": {"type": "number"},
                    "borrowAsset": {"type": "string", "enum": ["USDC", "USDT", "DAI"]},
                },
                "required": ["collateral", "collateralAmount", "targetLTV"],
            },
        },
    },
]

TOOL_MAP = {
    "lending_rates_query": "lending.rates.query",
    "lending_risk_assess": "lending.risk.assess",
}


def run_agent(user_message: str):
    messages = [
        {"role": "system", "content": "You are a DeFi lending analyst. Use the available tools to answer questions about BTC lending markets."},
        {"role": "user", "content": user_message},
    ]

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        tools=tools,
    )

    while response.choices[0].finish_reason == "tool_calls":
        for tool_call in response.choices[0].message.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)
            mcp_name = TOOL_MAP.get(fn_name, fn_name)

            print(f"  -> Calling {mcp_name}({fn_args})")
            result = call_syenite(mcp_name, fn_args)

            messages.append(response.choices[0].message)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result),
            })

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
        )

    print(f"\n{response.choices[0].message.content}")


if __name__ == "__main__":
    run_agent("What are the best BTC lending rates right now? Which protocol should I use to borrow USDC against 1 wBTC at 50% LTV?")
