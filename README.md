# Strava MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes your Strava data to Claude Desktop (or any other MCP client). Use it to let Claude analyse your training history and build personalised training plans.

---

## Tools

| Tool | Description |
|---|---|
| `get_athlete` | Your Strava profile |
| `get_athlete_stats` | All-time / YTD / recent totals |
| `get_athlete_zones` | Heart rate & power zones |
| `update_athlete` | Update weight |
| `list_activities` | Paginated activity list with filters |
| `get_activity` | Full activity detail (splits, best efforts) |
| `get_activity_laps` | Lap-by-lap breakdown |
| `get_activity_streams` | Time-series HR, pace, elevation, cadence, power |
| `get_activity_zones` | Time-in-zone for a single activity |
| `create_activity` | Log a manual training session |
| `update_activity` | Edit name, description, gear |
| `list_starred_segments` | Your bookmarked benchmark segments |
| `get_segment` | Segment info and hazard flag |
| `explore_segments` | Find segments in a bounding box |
| `list_segment_efforts` | Your efforts on a segment over time |
| `get_segment_effort` | Single effort details |
| `get_segment_streams` | Elevation/gradient streams for a segment |
| `list_routes` | Your saved routes |
| `get_route` | Full route details |
| `get_gear` | Bike/shoe details and mileage |
| `list_clubs` | Clubs you belong to |

---

## Prerequisites

- Node.js 18+ — [nodejs.org](https://nodejs.org)
- Claude Desktop — [claude.ai/download](https://claude.ai/download)
- A free [Strava API application](https://www.strava.com/settings/api) (each person needs their own — takes 2 minutes)

---

## Setup

### Windows

1. Download **[install.bat](https://github.com/dovgri1/strava-mcp-server/raw/main/install.bat)** and **[install.ps1](https://github.com/dovgri1/strava-mcp-server/raw/main/install.ps1)** into the same folder
2. Double-click `install.bat`
3. Follow the prompts — restart Claude Desktop when done

### macOS

1. Download **[install.command](https://github.com/dovgri1/strava-mcp-server/raw/main/install.command)**
2. Double-click it — Terminal opens and runs the installer
3. Follow the prompts — restart Claude Desktop when done

> **First time only:** macOS may show a security warning. Right-click the file → **Open** → **Open** to proceed. This is standard macOS behaviour for files downloaded from the internet.

> Node.js is installed automatically via Homebrew if you don't have it.

---

### What the installer does (both platforms)

1. Installs Node.js if not present
2. Downloads this project
3. Opens [strava.com/settings/api](https://www.strava.com/settings/api) — you create a free API app and paste in your Client ID + Secret
4. Opens the Strava authorization page in your browser
5. Writes everything to Claude Desktop config automatically
6. Done — just restart Claude Desktop

---

### Getting your Strava API credentials

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Create an app (any name, website, description)
3. Set **Authorization Callback Domain** to `localhost`
4. Copy your **Client ID** and **Client Secret** — the installer will ask for them

---

### Manual setup (for developers)

```bash
npm install
node scripts/auth.mjs    # opens browser, writes tokens to .env
npm run build
npm run print-config     # prints the Claude Desktop config block
```

---

## Claude Desktop config format

```json
{
  "mcpServers": {
    "strava": {
      "command": "node",
      "args": ["/absolute/path/to/strava-mcp-server/dist/index.js"],
      "env": {
        "STRAVA_CLIENT_ID": "...",
        "STRAVA_CLIENT_SECRET": "...",
        "STRAVA_REFRESH_TOKEN": "..."
      }
    }
  }
}
```

> `npm run print-config` generates this automatically with your correct path and tokens.

---

## Local development

```bash
npm run dev       # run without building (uses tsx)
npm run inspect   # interactive MCP inspector
```

---

## Token refresh

Access tokens expire after 6 hours. The server refreshes them automatically using the stored refresh token — no action needed. The new token is cached in `.token-cache.json` (git-ignored).

If you ever get an auth error, re-run:
```bash
node scripts/auth.mjs
npm run print-config   # get updated STRAVA_REFRESH_TOKEN for the config
```

---

## Scopes requested

| Scope | Needed for |
|---|---|
| `read` / `read_all` | Activities, segments, routes |
| `profile:read_all` | Full athlete profile |
| `activity:read_all` | Private activities |
| `activity:write` | `create_activity`, `update_activity` |

---

## Example prompts for Claude

> "Analyse my last 8 weeks of running and suggest a 10-week half-marathon training plan."

> "What are my heart rate zones? Show me how much time I spent in each zone last month."

> "I have a marathon in 12 weeks. Based on my recent activity data, build a periodised training block."

> "Which of my Strava routes are best for a tempo run? Summarise their elevation profiles."

> "Compare my average pace and heart rate this month vs last month."
