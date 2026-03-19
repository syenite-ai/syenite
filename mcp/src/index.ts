import "dotenv/config";
import express from "express";
import path from "path";
import { existsSync } from "fs";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { checkRateLimit, getClientIp } from "./auth/rate-limit.js";
import { getHealthStatus } from "./logging/health.js";
import { getUsageStats } from "./logging/usage.js";
import { landingPageHtml } from "./web/landing.js";
import { dashboardHtml } from "./web/dashboard.js";
import { wellKnownMcp } from "./web/well-known.js";
import {
  getDocsIndexHtml,
  getDocBySlug,
  DOC_SLUGS,
} from "./web/docs.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? "admin").trim();

const app = express();
app.set("trust proxy", true);
app.use(express.json());

// ── MCP Endpoint (stateless, open access) ────────────────────────────

app.post("/mcp", async (req, res) => {
  const clientIp = getClientIp(req);

  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    res.status(429).json({
      jsonrpc: "2.0",
      error: {
        code: -32002,
        message: `Rate limit exceeded (30 req/min). Resets at ${new Date(rateCheck.resetAt).toISOString()}`,
      },
      id: null,
    });
    return;
  }

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = createMcpServer(clientIp);

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.warn("[syenite] MCP request handler error:", e instanceof Error ? e.message : e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: e instanceof Error ? e.message : "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Use POST for MCP requests. See / for documentation." });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({ error: "Session management not available (stateless mode)." });
});

// ── Static assets (icon for landing / favicon) ─────────────────────────

const distAssets = path.join(process.cwd(), "dist", "assets");
const devAssets = path.join(process.cwd(), "assets");
const assetsDir = existsSync(distAssets) ? distAssets : devAssets;
app.use("/assets", express.static(assetsDir));

// ── Web Routes ──────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.type("html").send(landingPageHtml());
});

app.get("/health", async (_req, res) => {
  const health = await getHealthStatus();
  res.status(health.status === "unhealthy" ? 503 : 200).json(health);
});

app.get("/.well-known/mcp.json", (_req, res) => {
  res.json(wellKnownMcp());
});

// ── Docs ────────────────────────────────────────────────────────────

app.get("/docs", (_req, res) => {
  const html = getDocsIndexHtml();
  if (!html) {
    res.status(404).send("Docs not found");
    return;
  }
  res.type("html").send(html);
});

app.get("/docs/:slug", (req, res) => {
  const html = getDocBySlug(req.params.slug);
  if (!html) {
    res.status(404).send("Not found");
    return;
  }
  res.type("html").send(html);
});

// ── Sitemap ──────────────────────────────────────────────────────────

app.get("/sitemap.xml", (_req, res) => {
  const base = "https://syenite.ai";
  const urls = [
    base + "/",
    base + "/docs",
    ...DOC_SLUGS.map((slug) => base + "/docs/" + slug),
  ];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n") +
    "\n</urlset>";
  res.type("application/xml").send(xml);
});

// ── Dashboard (password-protected) ──────────────────────────────────

app.get("/dashboard", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Syenite Admin"');
    res.status(401).send("Authentication required");
    return;
  }
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const colonIdx = decoded.indexOf(":");
  const password = colonIdx === -1 ? "" : decoded.slice(colonIdx + 1).trim();
  if (password !== ADMIN_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="Syenite Admin"');
    res.status(401).send("Invalid credentials");
    return;
  }
  const stats = getUsageStats();
  res.type("html").send(dashboardHtml(stats));
});

app.get("/dashboard/stats", (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Basic ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const colonIdx = decoded.indexOf(":");
  const password = colonIdx === -1 ? "" : decoded.slice(colonIdx + 1).trim();
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json(getUsageStats());
});

// ── Start ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Syenite MCP Server running on http://localhost:${PORT}`);
  console.log(`  MCP endpoint:  POST http://localhost:${PORT}/mcp`);
  console.log(`  Landing page:  http://localhost:${PORT}/`);
  console.log(`  Docs:         http://localhost:${PORT}/docs`);
  console.log(`  Sitemap:      http://localhost:${PORT}/sitemap.xml`);
  console.log(`  Health check:  http://localhost:${PORT}/health`);
  console.log(`  Dashboard:     http://localhost:${PORT}/dashboard`);
});
