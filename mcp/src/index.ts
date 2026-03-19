import "dotenv/config";
import express from "express";
import path from "path";
import { existsSync } from "fs";
import { timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { checkRateLimit, getClientIp } from "./auth/rate-limit.js";
import { getHealthStatus } from "./logging/health.js";
import { getUsageStats } from "./logging/usage.js";
import { getPrometheusMetrics, recordRateLimitHit } from "./logging/metrics.js";
import { log } from "./logging/logger.js";
import { warmCache, startBackgroundRefresh } from "./data/warm-cache.js";
import { startAlertChecker } from "./data/alert-checker.js";
import { landingPageHtml } from "./web/landing.js";
import { dashboardHtml } from "./web/dashboard.js";
import { wellKnownMcp } from "./web/well-known.js";
import { agentRegistrationJson } from "./web/agent-registration.js";
import { initSchema } from "./data/db.js";
import { seedApiKeyFromEnv } from "./auth/keys.js";
import {
  getDocsIndexHtml,
  getDocBySlug,
  DOC_SLUGS,
} from "./web/docs.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const ADMIN_PASSWORD = (
  process.env.DASHBOARD_PASSWORD ??
  process.env.ADMIN_PASSWORD ??
  ""
).trim();

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "100kb" }));

app.use((_req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("X-XSS-Protection", "0");
  next();
});

// ── MCP Endpoint (stateless, open access) ────────────────────────────

app.post("/mcp", async (req, res) => {
  const clientIp = getClientIp(req);

  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    recordRateLimitHit();
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
    log.warn("MCP request handler error", { error: e instanceof Error ? e.message : String(e) });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
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

// ── Auth helper (used by dashboard + metrics) ───────────────────────

function verifyDashboardAuth(req: express.Request, res: express.Response): boolean {
  if (!ADMIN_PASSWORD) {
    res.status(503).send("Dashboard disabled — no DASHBOARD_PASSWORD configured");
    return false;
  }

  const clientIp = getClientIp(req);
  const rl = checkRateLimit(`dashboard:${clientIp}`);
  if (!rl.allowed) {
    res.status(429).send("Too many attempts");
    return false;
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Syenite Admin"');
    res.status(401).send("Authentication required");
    return false;
  }

  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const colonIdx = decoded.indexOf(":");
  const password = colonIdx === -1 ? "" : decoded.slice(colonIdx + 1).trim();

  if (!constantTimeEqual(password, ADMIN_PASSWORD)) {
    res.set("WWW-Authenticate", 'Basic realm="Syenite Admin"');
    res.status(401).send("Invalid credentials");
    return false;
  }

  return true;
}

// ── Web Routes ──────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.type("html").send(landingPageHtml());
});

app.get("/health", async (_req, res) => {
  const health = await getHealthStatus();
  res.status(health.status === "unhealthy" ? 503 : 200).json(health);
});

app.get("/metrics", async (req, res) => {
  if (!verifyDashboardAuth(req, res)) return;
  const body = await getPrometheusMetrics();
  res.type("text/plain; version=0.0.4; charset=utf-8").send(body);
});

app.get("/.well-known/mcp.json", (_req, res) => {
  res.json(wellKnownMcp());
});

app.get("/.well-known/agent-registration.json", (_req, res) => {
  res.json(agentRegistrationJson());
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

app.get("/dashboard", async (req, res) => {
  if (!verifyDashboardAuth(req, res)) return;
  const stats = await getUsageStats();
  res.type("html").send(dashboardHtml(stats));
});

app.get("/dashboard/stats", async (req, res) => {
  if (!verifyDashboardAuth(req, res)) return;
  res.json(await getUsageStats());
});

// ── Start ───────────────────────────────────────────────────────────

const start = async () => {
  try {
    await initSchema();
    await seedApiKeyFromEnv();
  } catch (e) {
    log.error("DB init failed", { error: e instanceof Error ? e.message : String(e) });
    process.exit(1);
  }
  if (!ADMIN_PASSWORD) {
    log.warn("DASHBOARD_PASSWORD not set — dashboard and metrics are disabled");
  }

  await warmCache();
  startBackgroundRefresh();
  startAlertChecker(60_000);

  app.listen(PORT, () => {
    log.info("server started", {
      port: PORT,
      endpoints: {
        mcp: `POST http://localhost:${PORT}/mcp`,
        health: `http://localhost:${PORT}/health`,
        metrics: `http://localhost:${PORT}/metrics`,
        dashboard: `http://localhost:${PORT}/dashboard`,
      },
    });
  });
};
start();
