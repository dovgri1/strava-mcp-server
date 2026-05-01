#!/usr/bin/env node
/**
 * Interactive setup wizard — run once after cloning.
 * Guides through: checking Node version, creating .env,
 * running the OAuth flow, building, and printing the Claude Desktop config.
 */
import { execSync, exec } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

function step(msg) {
  console.log(`\n\x1b[36m▶ ${msg}\x1b[0m`);
}
function ok(msg) {
  console.log(`\x1b[32m✔ ${msg}\x1b[0m`);
}
function warn(msg) {
  console.log(`\x1b[33m⚠ ${msg}\x1b[0m`);
}
function err(msg) {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
}

// ── 1. Node version check ────────────────────────────────────────────────────
step("Checking Node.js version");
const nodeVer = parseInt(process.versions.node.split(".")[0], 10);
if (nodeVer < 18) {
  err(`Node.js 18+ required. You have ${process.versions.node}. Download from https://nodejs.org`);
  process.exit(1);
}
ok(`Node.js ${process.versions.node}`);

// ── 2. npm install ───────────────────────────────────────────────────────────
step("Installing dependencies");
try {
  execSync("npm install", { cwd: ROOT, stdio: "inherit" });
  ok("Dependencies installed");
} catch {
  err("npm install failed");
  process.exit(1);
}

// ── 3. Collect credentials ───────────────────────────────────────────────────
step("Strava API credentials");
console.log(
  "\nYou need a free Strava API application. If you don't have one:"
);
console.log("  1. Go to https://www.strava.com/settings/api");
console.log('  2. Create an app — set Authorization Callback Domain to: localhost');
console.log("  3. Copy your Client ID and Client Secret\n");

const envPath = join(ROOT, ".env");
let clientId = "";
let clientSecret = "";

if (existsSync(envPath)) {
  const existing = {};
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) existing[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  if (existing.STRAVA_CLIENT_ID && existing.STRAVA_CLIENT_SECRET) {
    warn("Found existing .env — using stored credentials");
    clientId = existing.STRAVA_CLIENT_ID;
    clientSecret = existing.STRAVA_CLIENT_SECRET;
  }
}

if (!clientId) {
  clientId = (await ask("Enter your Strava Client ID: ")).trim();
  clientSecret = (await ask("Enter your Strava Client Secret: ")).trim();
  if (!clientId || !clientSecret) {
    err("Client ID and Secret are required.");
    process.exit(1);
  }
  writeFileSync(
    envPath,
    `STRAVA_CLIENT_ID=${clientId}\nSTRAVA_CLIENT_SECRET=${clientSecret}\nSTRAVA_REFRESH_TOKEN=\n`
  );
  ok(".env created");
}

// ── 4. OAuth flow ────────────────────────────────────────────────────────────
step("Strava authorization (browser will open)");
console.log("Press Enter to open the Strava authorization page...");
await ask("");

rl.close();

// Run auth.mjs — it handles everything and writes back to .env
const { createServer } = await import("http");
const PORT = 8888;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const scopes = [
  "read", "read_all", "profile:read_all", "activity:read_all", "activity:write",
].join(",");

const authUrl =
  `https://www.strava.com/oauth/authorize` +
  `?client_id=${clientId}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&approval_prompt=force` +
  `&scope=${encodeURIComponent(scopes)}`;

const cmd =
  process.platform === "win32"
    ? `start "" "${authUrl}"`
    : process.platform === "darwin"
    ? `open "${authUrl}"`
    : `xdg-open "${authUrl}"`;
try { exec(cmd); } catch { /* ignore */ }

console.log(`\nIf the browser didn't open, visit:\n  ${authUrl}\n`);
console.log("Waiting for you to authorize in the browser...");

await new Promise((resolve, reject) => {
  const server = createServer(async (req, res) => {
    if (!req.url?.startsWith("/callback")) { res.writeHead(404); res.end(); return; }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h1>Authorization failed</h1><p>${error ?? "No code"}</p>`);
      server.close();
      reject(new Error("Authorization failed: " + error));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Authorized! You can close this tab.</h1>");

    const tokenRes = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      server.close();
      reject(new Error(`Token exchange failed: ${tokenRes.status} ${t}`));
      return;
    }

    const data = await tokenRes.json();
    writeFileSync(
      envPath,
      `STRAVA_CLIENT_ID=${clientId}\n` +
      `STRAVA_CLIENT_SECRET=${clientSecret}\n` +
      `STRAVA_REFRESH_TOKEN=${data.refresh_token}\n` +
      `STRAVA_ACCESS_TOKEN=${data.access_token}\n` +
      `STRAVA_TOKEN_EXPIRES_AT=${data.expires_at}\n`
    );

    ok(`Authorized as: ${data.athlete?.firstname} ${data.athlete?.lastname}`);
    server.close();
    resolve();
  });

  server.listen(PORT, "127.0.0.1");
});

// ── 5. Build ─────────────────────────────────────────────────────────────────
step("Building");
try {
  execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
  ok("Build complete");
} catch {
  err("Build failed");
  process.exit(1);
}

// ── 6. Print Claude Desktop config ───────────────────────────────────────────
const env = {};
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const eq = line.indexOf("=");
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
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

const configPath =
  process.platform === "win32"
    ? `${process.env.APPDATA}\\Claude\\claude_desktop_config.json`
    : process.platform === "darwin"
    ? `${process.env.HOME}/Library/Application Support/Claude/claude_desktop_config.json`
    : `${process.env.HOME}/.config/Claude/claude_desktop_config.json`;

console.log("\n\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
console.log("\x1b[1mSetup complete!\x1b[0m\n");
console.log(`Add this to your Claude Desktop config:`);
console.log(`  \x1b[90m${configPath}\x1b[0m\n`);
console.log(JSON.stringify(config, null, 2));
console.log("\n\x1b[90mIf the file already has other mcpServers, merge the 'strava' block in.\x1b[0m");
console.log("\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n");
console.log("Then restart Claude Desktop and you're good to go!");
