#!/usr/bin/env node
/**
 * Prints the claude_desktop_config.json snippet to paste, based on your .env.
 * Run after: node scripts/auth.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const envPath = join(ROOT, ".env");

if (!existsSync(envPath)) {
  console.error("ERROR: .env file not found. Run 'node scripts/auth.mjs' first.");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const required = ["STRAVA_CLIENT_ID", "STRAVA_CLIENT_SECRET", "STRAVA_REFRESH_TOKEN"];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error(`ERROR: Missing values in .env: ${missing.join(", ")}`);
  process.exit(1);
}

const distPath = join(ROOT, "dist", "index.js");

const config = {
  mcpServers: {
    strava: {
      command: "node",
      args: [distPath],
      env: {
        STRAVA_CLIENT_ID: env.STRAVA_CLIENT_ID,
        STRAVA_CLIENT_SECRET: env.STRAVA_CLIENT_SECRET,
        STRAVA_REFRESH_TOKEN: env.STRAVA_REFRESH_TOKEN,
      },
    },
  },
};

console.log("\nPaste this into your Claude Desktop config file:");
console.log("  Windows: %APPDATA%\\Claude\\claude_desktop_config.json");
console.log("  macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json");
console.log("\n" + JSON.stringify(config, null, 2) + "\n");
console.log("Then restart Claude Desktop.\n");
