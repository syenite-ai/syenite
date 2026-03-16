import "dotenv/config";
import { createApiKey, listApiKeys } from "../auth/keys.js";

const args = process.argv.slice(2);

if (args[0] === "list") {
  const keys = listApiKeys();
  if (keys.length === 0) {
    console.log("No API keys found.");
  } else {
    console.log("\nAPI Keys:\n");
    for (const k of keys) {
      const status = k.revoked ? " [REVOKED]" : "";
      console.log(`  ${k.prefix}...  ${k.name}  (${k.createdAt})${status}`);
    }
    console.log();
  }
  process.exit(0);
}

const nameIdx = args.indexOf("--name");
const name = nameIdx >= 0 ? args[nameIdx + 1] : undefined;

const emailIdx = args.indexOf("--email");
const email = emailIdx >= 0 ? args[emailIdx + 1] : undefined;

if (!name) {
  console.error("Usage: npm run generate-key -- --name <name> [--email <email>]");
  console.error("       npm run generate-key -- list");
  process.exit(1);
}

const { key, id } = createApiKey(name, email);
console.log(`\nAPI key created for "${name}":\n`);
console.log(`  ${key}\n`);
console.log("Store this key securely — it won't be shown again.\n");
