#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { warmCache, startBackgroundRefresh } from "./data/warm-cache.js";

const server = createMcpServer("stdio");
const transport = new StdioServerTransport();

await warmCache();
startBackgroundRefresh();

await server.connect(transport);
process.stderr.write("Syenite MCP server running on stdio\n");
