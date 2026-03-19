import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Allowed doc slugs. Only these return 200; others should 404. */
export const DOC_SLUGS = [
  "quick-start",
  "build-defi-lending-agent-30-min",
  "lending-rates-and-risk",
  "lending-execution",
  "yield-opportunities",
  "swap-and-bridge",
  "tx-trust-layer",
  "wallet-balances-and-gas",
  "position-alerts-and-carry",
  "prediction-and-strategy",
  "security-and-production",
  "why-agentic-defi",
  "erc-8004-agent-registration",
  "mcp-defi-discovery",
  "seo-and-indexing",
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
