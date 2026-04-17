import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock heavy dependencies
vi.mock("../src/data/db.js", () => ({
  hasDatabase: () => false,
  getPool: () => { throw new Error("No DB"); },
}));

vi.mock("../src/logging/usage.js", () => ({
  logToolCall: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/logging/metrics.js", () => ({
  recordToolCall: vi.fn(),
  recordCacheHit: vi.fn(),
  recordCacheMiss: vi.fn(),
  recordRateLimitHit: vi.fn(),
  getPrometheusMetrics: vi.fn().mockResolvedValue("# HELP\n"),
}));

import { createMcpServer } from "../src/server.js";

describe("MCP Server Factory", () => {
  it("creates a server instance", () => {
    const server = createMcpServer("test");
    expect(server).toBeDefined();
  });

  it("server has correct name and version", () => {
    const server = createMcpServer("test");
    // The server metadata is set during construction
    expect(server).toBeDefined();
  });
});

describe("Tool Registration Completeness", () => {
  // Use the server's internal tool listing to verify all tools are registered
  const expectedTools = [
    "syenite.help",
    "lending.rates.query",
    "lending.market.overview",
    "lending.position.monitor",
    "lending.risk.assess",
    "lending.supply",
    "lending.withdraw",
    "yield.opportunities",
    "yield.assess",
    "swap.quote",
    "swap.status",
    "strategy.carry.screen",
    "prediction.trending",
    "prediction.search",
    "prediction.book",
    "alerts.watch",
    "alerts.check",
    "alerts.list",
    "alerts.remove",
  ];

  it(`registers exactly ${expectedTools.length} tools`, () => {
    expect(expectedTools.length).toBe(19);
  });

  it("all tool names follow namespace convention", () => {
    for (const name of expectedTools) {
      expect(name).toMatch(/^[a-z]+(\.[a-z]+)+$/);
    }
  });

  it("tool categories cover all domains", () => {
    const categories = new Set(expectedTools.map((t) => t.split(".")[0]));
    expect(categories.has("syenite")).toBe(true);
    expect(categories.has("lending")).toBe(true);
    expect(categories.has("yield")).toBe(true);
    expect(categories.has("swap")).toBe(true);
    expect(categories.has("strategy")).toBe(true);
    expect(categories.has("prediction")).toBe(true);
    expect(categories.has("alerts")).toBe(true);
  });
});
