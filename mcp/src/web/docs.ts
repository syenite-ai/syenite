import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Allowed doc slugs. Only these return 200; others should 404. */
export const DOC_SLUGS = [
  "build-defi-lending-agent-30-min",
  "quick-start",
  "lending-rates-and-risk",
  "yield-opportunities",
  "swap-and-bridge",
  "security-and-production",
  "mcp-defi-discovery",
  "why-agentic-defi",
  "erc-8004-agent-registration",
  "x402-agent-payments",
  "wallet-balances-and-gas",
  "batch-swaps-multi-chain",
  "position-alerts-and-carry",
  "prediction-markets",
  "seo-and-indexing",
  "tx-trust-layer",
  "mcp-trust-speed-security",
  "lending-execution",
] as const;

export type DocSlug = (typeof DOC_SLUGS)[number];

/** Docs dir: next to this file (dist/web/docs) or cwd-relative for production. */
function getDocsDir(): string {
  const nextToModule = path.join(__dirname, "docs");
  if (existsSync(path.join(nextToModule, "index.html"))) return nextToModule;
  const fromCwd = path.join(process.cwd(), "dist", "web", "docs");
  if (existsSync(path.join(fromCwd, "index.html"))) return fromCwd;
  return nextToModule;
}

const DOCS_DIR = getDocsDir();

function readDocFile(name: string): string | null {
  const filePath = path.join(DOCS_DIR, name);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

/** Returns HTML for the docs index page, or null if not found. */
export function getDocsIndexHtml(): string | null {
  return readDocFile("index.html");
}

/** Returns HTML for a doc by slug, or null if slug invalid or file missing. */
export function getDocBySlug(slug: string): string | null {
  if (!DOC_SLUGS.includes(slug as DocSlug)) return null;
  return readDocFile(`${slug}.html`);
}
