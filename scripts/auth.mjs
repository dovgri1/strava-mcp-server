#!/usr/bin/env node
/**
 * One-time helper to obtain a Strava refresh token via the OAuth2 flow.
 *
 * Usage:
 *   node scripts/auth.mjs
 *
 * You will need STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET set in your
 * environment (or a .env file in the project root) before running.
 *
 * The script opens the Strava authorization URL in your browser (or prints
 * it), starts a temporary HTTP server on localhost:8888 to catch the
 * redirect, then exchanges the code for tokens and prints the values you
 * need to add to your .env file.
 */

import { createServer } from "http";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── Load .env ──────────────────────────────────────────────────────────────
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const PORT = 8888;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "ERROR: STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in your .env file."
  );
  process.exit(1);
}

const scopes = [
  "read",
  "read_all",
  "profile:read_all",
  "activity:read_all",
  "activity:write",
].join(",");

const authUrl =
  `https://www.strava.com/oauth/authorize` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&approval_prompt=force` +
  `&scope=${encodeURIComponent(scopes)}`;

console.log("\n=== Strava OAuth2 Authorization ===");
console.log(`\nOpen this URL in your browser:\n\n  ${authUrl}\n`);

// Try to auto-open (best effort)
try {
  const { exec } = await import("child_process");
  const cmd =
    process.platform === "win32"
      ? `start "" "${authUrl}"`
      : process.platform === "darwin"
      ? `open "${authUrl}"`
      : `xdg-open "${authUrl}"`;
  exec(cmd);
} catch {
  // ignore
}

// ── Temporary callback server ──────────────────────────────────────────────
const server = createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) {
    res.writeHead(404);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>Authorization failed</h1><p>${error ?? "No code returned"}</p>`);
    console.error("Authorization failed:", error);
    server.close();
    process.exit(1);
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
    <html><body style="font-family:sans-serif;max-width:500px;margin:40px auto;text-align:center">
      <h2 style="color:green">&#10003; Authorized!</h2>
      <p>You can close this tab and return to the installer.</p>
    </body></html>
  `);

  // Exchange code for tokens
  const tokenRes = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Token exchange failed:", tokenRes.status, text);
    server.close();
    process.exit(1);
  }

  const data = await tokenRes.json();
  const { access_token, refresh_token, expires_at, athlete, scope } = data;

  // Verify that all required scopes were granted
  const grantedScopes = (scope || "").split(",").map(s => s.trim());
  const requiredScopes = ["activity:read_all", "activity:write"];
  const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

  if (missingScopes.length > 0) {
    console.error(`\n⚠️  WARNING: Missing scopes: ${missingScopes.join(", ")}`);
    console.error("   On the Strava authorization page you must tick ALL checkboxes.");
    console.error("   Please run this script again and make sure every box is checked.\n");
    server.close();
    process.exit(1);
  }

  console.log("\n✅ Success! Tokens obtained for athlete:", athlete?.firstname, athlete?.lastname);
  console.log(`   Scopes granted: ${grantedScopes.join(", ")}`);
  console.log("\nAdd these values to your .env file:\n");
  console.log(`STRAVA_CLIENT_ID=${CLIENT_ID}`);
  console.log(`STRAVA_CLIENT_SECRET=${CLIENT_SECRET}`);
  console.log(`STRAVA_REFRESH_TOKEN=${refresh_token}`);
  console.log(`STRAVA_ACCESS_TOKEN=${access_token}`);
  console.log(`STRAVA_TOKEN_EXPIRES_AT=${expires_at}`);

  // Optionally write .env automatically
  const envContent =
    `STRAVA_CLIENT_ID=${CLIENT_ID}\n` +
    `STRAVA_CLIENT_SECRET=${CLIENT_SECRET}\n` +
    `STRAVA_REFRESH_TOKEN=${refresh_token}\n` +
    `STRAVA_ACCESS_TOKEN=${access_token}\n` +
    `STRAVA_TOKEN_EXPIRES_AT=${expires_at}\n`;

  writeFileSync(envPath, envContent);
  console.log(`\n.env file has been updated at: ${envPath}`);

  server.close();
  process.exit(0);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Waiting for redirect on http://localhost:${PORT}/callback ...`);
});
