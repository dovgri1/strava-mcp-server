#!/usr/bin/env bash
# Strava for Claude Desktop — macOS Installer
#
# One-liner install (paste into Terminal):
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/dovgri1/strava-mcp-server/main/install.sh)"
#
# Or if you already downloaded this file:
#   bash install.sh

set -e

GITHUB_USER="dovgri1"
GITHUB_REPO="strava-mcp-server"
INSTALL_DIR="$HOME/.local/strava-mcp-server"
CLAUDE_CFG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; RESET='\033[0m'

step() { echo -e "\n${CYAN}  >> $1${RESET}"; }
ok()   { echo -e "${GREEN}     $1${RESET}"; }
warn() { echo -e "${YELLOW}     $1${RESET}"; }
bail() { echo -e "\n${RED}  !! $1${RESET}\n"; exit 1; }

clear
echo ""
echo -e "${CYAN}  ===========================================${RESET}"
echo -e "${CYAN}    Strava for Claude Desktop — Installer   ${RESET}"
echo -e "${CYAN}  ===========================================${RESET}"

# ── 1. Node.js ────────────────────────────────────────────────────────────────
step "Checking Node.js"
NODE_OK=false
if command -v node &>/dev/null; then
    NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        NODE_OK=true
        ok "Node.js $(node --version) found"
    fi
fi

if [ "$NODE_OK" = false ]; then
    warn "Node.js not found — installing via Homebrew..."

    # Install Homebrew if needed
    if ! command -v brew &>/dev/null; then
        warn "Homebrew not found — installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        # Add brew to PATH for Apple Silicon Macs
        if [ -f /opt/homebrew/bin/brew ]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    fi

    brew install node
    ok "Node.js $(node --version) installed"
fi

# ── 2. Download project ───────────────────────────────────────────────────────
step "Downloading Strava MCP Server"
ZIP_URL="https://github.com/$GITHUB_USER/$GITHUB_REPO/archive/refs/heads/main.zip"
ZIP_TMP="$(mktemp).zip"
EXTRACT_TMP="$(mktemp -d)"

curl -fsSL "$ZIP_URL" -o "$ZIP_TMP" || bail "Download failed. Check your internet connection."

rm -rf "$INSTALL_DIR"
unzip -q "$ZIP_TMP" -d "$EXTRACT_TMP"
mv "$EXTRACT_TMP/$GITHUB_REPO-main" "$INSTALL_DIR"
rm -rf "$ZIP_TMP" "$EXTRACT_TMP"
ok "Installed to $INSTALL_DIR"

# ── 3. Build ──────────────────────────────────────────────────────────────────
step "Installing dependencies and building"
cd "$INSTALL_DIR"
npm install --silent
npm run build
ok "Ready"

# ── 4. Strava API credentials ─────────────────────────────────────────────────
step "Strava API credentials"
echo ""
warn "Opening your Strava API settings in the browser..."
warn ""
warn "Steps:"
warn "  1. Click 'Create App' (or use an existing one)"
warn "  2. Fill in any name, website and description"
warn "  3. Set Authorization Callback Domain to:  localhost"
warn "  4. Save — then copy the Client ID and Client Secret"
echo ""
open "https://www.strava.com/settings/api" 2>/dev/null || true

read -rp "  Press Enter once you have your Client ID and Secret..."
echo ""
read -rp "  Client ID: " CLIENT_ID
read -rp "  Client Secret: " CLIENT_SECRET

[ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ] && bail "Client ID and Client Secret are required."

printf "STRAVA_CLIENT_ID=%s\nSTRAVA_CLIENT_SECRET=%s\nSTRAVA_REFRESH_TOKEN=\n" \
    "$CLIENT_ID" "$CLIENT_SECRET" > "$INSTALL_DIR/.env"

# ── 5. Strava authorization ───────────────────────────────────────────────────
step "Authorising with Strava"
echo ""
warn "A browser window will open."
warn "Click Authorize on ALL checkboxes."
echo ""
read -rp "  Press Enter to open the browser..."

node "$INSTALL_DIR/scripts/auth.mjs" || bail "Strava authorization failed."

# Read tokens
declare -A TOKENS
while IFS='=' read -r key val; do
    [[ "$key" =~ ^# ]] && continue
    [ -z "$key" ] && continue
    TOKENS["$key"]="$val"
done < "$INSTALL_DIR/.env"

[ -z "${TOKENS[STRAVA_REFRESH_TOKEN]}" ] && bail "Authorization succeeded but no refresh token was saved."
ok "Authorized successfully"

# ── 6. Write Claude Desktop config ───────────────────────────────────────────
step "Updating Claude Desktop config"
mkdir -p "$(dirname "$CLAUDE_CFG")"

DIST_PATH="$INSTALL_DIR/dist/index.js"

# Use Python (always available on macOS) to safely merge the JSON
python3 - <<PYEOF
import json, os, sys

cfg_path = os.path.expanduser("$CLAUDE_CFG")
dist_path = "$DIST_PATH"

tokens = {}
with open("$INSTALL_DIR/.env") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'): continue
        k, _, v = line.partition('=')
        tokens[k.strip()] = v.strip()

strava_entry = {
    "command": "node",
    "args": [dist_path],
    "env": {
        "STRAVA_CLIENT_ID":     tokens.get("STRAVA_CLIENT_ID", ""),
        "STRAVA_CLIENT_SECRET": tokens.get("STRAVA_CLIENT_SECRET", ""),
        "STRAVA_REFRESH_TOKEN": tokens.get("STRAVA_REFRESH_TOKEN", ""),
    }
}

if os.path.exists(cfg_path):
    with open(cfg_path) as f:
        cfg = json.load(f)
else:
    cfg = {}

cfg.setdefault("mcpServers", {})["strava"] = strava_entry

with open(cfg_path, "w") as f:
    json.dump(cfg, f, indent=2)

print("     Config saved to: " + cfg_path)
PYEOF

# ── 7. Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ===========================================${RESET}"
echo -e "${GREEN}    Installation complete!                  ${RESET}"
echo -e "${GREEN}                                            ${RESET}"
echo -e "${GREEN}    Last step: Restart Claude Desktop       ${RESET}"
echo -e "${GREEN}    Then ask it anything about your         ${RESET}"
echo -e "${GREEN}    training!                               ${RESET}"
echo -e "${GREEN}  ===========================================${RESET}"
echo ""
