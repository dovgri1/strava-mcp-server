import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_CACHE_FILE = join(__dirname, "../.token-cache.json");

const STRAVA_BASE = "https://www.strava.com/api/v3";
const STRAVA_AUTH = "https://www.strava.com/api/v3/oauth/token";

interface TokenCache {
  access_token: string;
  expires_at: number;
  refresh_token: string;
}

function loadEnv(): void {
  const envPath = join(__dirname, "../.env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && val && !process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnv();

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

function readTokenCache(): TokenCache | null {
  try {
    if (existsSync(TOKEN_CACHE_FILE)) {
      return JSON.parse(readFileSync(TOKEN_CACHE_FILE, "utf-8")) as TokenCache;
    }
  } catch {
    // ignore
  }
  return null;
}

function writeTokenCache(cache: TokenCache): void {
  try {
    writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // ignore — non-fatal
  }
}

async function refreshAccessToken(): Promise<string> {
  const clientId = getEnv("STRAVA_CLIENT_ID");
  const clientSecret = getEnv("STRAVA_CLIENT_SECRET");
  const refreshToken = getEnv("STRAVA_REFRESH_TOKEN");

  const response = await fetch(STRAVA_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };

  // Persist the potentially-rotated refresh token back to cache
  writeTokenCache({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  });

  // Also update the in-process env so subsequent calls within the same
  // process pick up the new refresh token without needing file I/O.
  process.env.STRAVA_REFRESH_TOKEN = data.refresh_token;

  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  // 1. Check in-memory / disk cache
  const cached = readTokenCache();
  const nowSec = Math.floor(Date.now() / 1000);
  if (cached && cached.expires_at > nowSec + 60) {
    return cached.access_token;
  }

  // 2. Fallback: refresh using the refresh token
  return refreshAccessToken();
}

export async function stravaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `${STRAVA_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava API error ${response.status} for ${url}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function stravaPost<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  return stravaFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
