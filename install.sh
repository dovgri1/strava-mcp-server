#!/usr/bin/env bash
# Strava MCP Server — macOS / Linux Installer
# Run: bash install.sh

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'
step() { echo -e "\n${CYAN}>> $1${RESET}"; }
ok()   { echo -e "${GREEN}   OK  $1${RESET}"; }
warn() { echo -e "${YELLOW}   !!  $1${RESET}"; }
fail() { echo -e "${RED}   XX  $1${RESET}"; }

echo ""
echo -e "${CYAN}============================================${RESET}"
echo -e "${CYAN}   Strava MCP Server — Setup${RESET}"
echo -e "${CYAN}============================================${RESET}"

# ── 1. Node.js ────────────────────────────────────────────────────────────────
step "Checking Node.js"
if ! command -v node &>/dev/null; then
    fail "Node.js not found."
    echo ""
    echo -e "${YELLOW}   Install Node.js 18+ from: https://nodejs.org${RESET}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${YELLOW}   Or via Homebrew: brew install node${RESET}"
    fi
    exit 1
fi
NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    fail "Node.js 18+ required. Found: $(node --version)"
    echo -e "${YELLOW}   Download from: https://nodejs.org${RESET}"
    exit 1
fi
ok "Node.js $(node --version)"

# ── 2. Install dependencies ───────────────────────────────────────────────────
step "Installing dependencies"
cd "$DIR"
npm install --silent
ok "Dependencies ready"

# ── 3. Run the interactive setup wizard ──────────────────────────────────────
step "Running setup wizard"
echo ""
node scripts/setup.mjs

echo ""
echo -e "${GREEN}All done!${RESET}"
