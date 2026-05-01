# Strava for Claude Desktop — Windows Installer
# Double-click install.bat to run this.

$ErrorActionPreference = 'Stop'

$GITHUB_USER  = 'dovgri1'
$GITHUB_REPO  = 'strava-mcp-server'
$INSTALL_DIR  = "$env:LOCALAPPDATA\strava-mcp-server"
$NODE_VERSION = '22.14.0'
$NODE_MSI     = "$env:TEMP\nodejs-installer.msi"
$CLAUDE_CFG   = "$env:APPDATA\Claude\claude_desktop_config.json"

function Step { param($t) Write-Host "`n  >> $t" -ForegroundColor Cyan }
function Ok   { param($t) Write-Host "     $t"   -ForegroundColor Green }
function Bail { param($t) Write-Host "`n  !! $t" -ForegroundColor Red; Read-Host "`n  Press Enter to close"; exit 1 }

Clear-Host
Write-Host ''
Write-Host '  ===========================================' -ForegroundColor Cyan
Write-Host '    Strava for Claude Desktop - Installer   ' -ForegroundColor Cyan
Write-Host '  ===========================================' -ForegroundColor Cyan

# ── 1. Node.js ────────────────────────────────────────────────────────────────
Step 'Checking Node.js'
$nodeOk = $false
try {
    $nv = (& node --version 2>$null)
    if ($nv -match 'v(\d+)\.' -and [int]$Matches[1] -ge 18) {
        $nodeOk = $true
        Ok "Node.js $nv already installed"
    }
} catch {}

if (-not $nodeOk) {
    Ok 'Node.js not found — downloading (about 30 MB, takes ~1 minute)...'
    $msiUrl = "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-x64.msi"
    try {
        Invoke-WebRequest -Uri $msiUrl -OutFile $NODE_MSI -UseBasicParsing
    } catch {
        Bail "Could not download Node.js. Check your internet connection and try again."
    }
    Ok 'Installing Node.js...'
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$NODE_MSI`" /qn /norestart"
    Remove-Item $NODE_MSI -ErrorAction SilentlyContinue
    # Reload PATH so node is immediately available
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path','User')
    Ok 'Node.js installed'
}

# ── 2. Download project ───────────────────────────────────────────────────────
Step 'Downloading Strava MCP Server'
$zipPath    = "$env:TEMP\strava-mcp-server.zip"
$extractDir = "$env:TEMP\strava-mcp-extract"
$zipUrl     = "https://github.com/$GITHUB_USER/$GITHUB_REPO/archive/refs/heads/main.zip"

try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
} catch {
    Bail "Could not download the project from GitHub. Make sure the repo is public and the username is correct."
}

if (Test-Path $INSTALL_DIR)  { Remove-Item $INSTALL_DIR  -Recurse -Force }
if (Test-Path $extractDir)   { Remove-Item $extractDir   -Recurse -Force }

Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
Move-Item "$extractDir\$GITHUB_REPO-main" $INSTALL_DIR
Remove-Item $zipPath    -ErrorAction SilentlyContinue
Remove-Item $extractDir -Recurse -ErrorAction SilentlyContinue
Ok "Installed to $INSTALL_DIR"

# ── 3. Install dependencies & build ──────────────────────────────────────────
Step 'Building the server'
Set-Location $INSTALL_DIR
& npm install --silent 2>$null
if ($LASTEXITCODE -ne 0) { Bail 'npm install failed.' }
& npm run build 2>$null
if ($LASTEXITCODE -ne 0) { Bail 'Build failed.' }
Ok 'Ready'

# ── 4. Strava API credentials ─────────────────────────────────────────────────
Step 'Strava API credentials'
Write-Host ''
Write-Host '  Opening your Strava API settings in the browser...' -ForegroundColor Yellow
Write-Host ''
Write-Host '  Steps:' -ForegroundColor Yellow
Write-Host '    1. Click "Create App" (or use an existing one)' -ForegroundColor Yellow
Write-Host '    2. Fill in any name, website and description' -ForegroundColor Yellow
Write-Host '    3. Set Authorization Callback Domain to:  localhost' -ForegroundColor Yellow
Write-Host '    4. Save — then copy the Client ID and Client Secret' -ForegroundColor Yellow
Write-Host ''
Start-Process 'https://www.strava.com/settings/api'
Read-Host '  Press Enter once you have your Client ID and Client Secret'

$clientId     = (Read-Host '  Client ID').Trim()
$clientSecret = (Read-Host '  Client Secret').Trim()

if (-not $clientId -or -not $clientSecret) {
    Bail 'Client ID and Client Secret are both required.'
}

# Write .env
@"
STRAVA_CLIENT_ID=$clientId
STRAVA_CLIENT_SECRET=$clientSecret
STRAVA_REFRESH_TOKEN=
"@ | Set-Content "$INSTALL_DIR\.env" -Encoding UTF8

# ── 5. Strava authorization ───────────────────────────────────────────────────
Step 'Authorising with Strava'
Write-Host ''
Write-Host '  A browser window will open. Click Authorize on ALL checkboxes.' -ForegroundColor Yellow
Write-Host ''
Read-Host '  Press Enter to open the browser'

& node scripts/auth.mjs
if ($LASTEXITCODE -ne 0) { Bail 'Strava authorization failed.' }

# Read fresh tokens from .env
$tokens = @{}
Get-Content "$INSTALL_DIR\.env" | ForEach-Object {
    if ($_ -match '^([^=]+)=(.+)') { $tokens[$Matches[1].Trim()] = $Matches[2].Trim() }
}
if (-not $tokens['STRAVA_REFRESH_TOKEN']) { Bail 'Authorization succeeded but no refresh token was saved.' }
Ok "Authorized successfully"

# ── 6. Update Claude Desktop config ──────────────────────────────────────────
Step 'Updating Claude Desktop config'

$distPath = "$INSTALL_DIR\dist\index.js"

$stravaBlock = [ordered]@{
    command = 'node'
    args    = @($distPath)
    env     = [ordered]@{
        STRAVA_CLIENT_ID     = $tokens['STRAVA_CLIENT_ID']
        STRAVA_CLIENT_SECRET = $tokens['STRAVA_CLIENT_SECRET']
        STRAVA_REFRESH_TOKEN = $tokens['STRAVA_REFRESH_TOKEN']
    }
}

$claudeDir = Split-Path $CLAUDE_CFG
if (-not (Test-Path $claudeDir)) {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
}

if (Test-Path $CLAUDE_CFG) {
    try {
        $cfg = Get-Content $CLAUDE_CFG -Raw | ConvertFrom-Json
    } catch {
        # Backup the broken file and start fresh
        Copy-Item $CLAUDE_CFG "$CLAUDE_CFG.bak" -Force
        $cfg = [PSCustomObject]@{ mcpServers = [PSCustomObject]@{} }
    }
} else {
    $cfg = [PSCustomObject]@{ mcpServers = [PSCustomObject]@{} }
}

if (-not $cfg.PSObject.Properties['mcpServers']) {
    $cfg | Add-Member -MemberType NoteProperty -Name mcpServers -Value ([PSCustomObject]@{})
}

if ($cfg.mcpServers.PSObject.Properties['strava']) {
    $cfg.mcpServers.strava = $stravaBlock
} else {
    $cfg.mcpServers | Add-Member -MemberType NoteProperty -Name strava -Value $stravaBlock
}

# ConvertTo-Json must be captured as a variable — piping through ForEach-Object
# splits the multiline string into individual lines, corrupting the file.
$json = $cfg | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($CLAUDE_CFG, $json, $utf8NoBom)

# Verify the file is valid JSON
try {
    Get-Content $CLAUDE_CFG -Raw | ConvertFrom-Json | Out-Null
    Ok "Claude Desktop config saved to: $CLAUDE_CFG"
} catch {
    Bail "Config was written but contains invalid JSON. Please open $CLAUDE_CFG and check it."
}

# ── 7. Done ───────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '  ===========================================' -ForegroundColor Green
Write-Host '    Installation complete!' -ForegroundColor Green
Write-Host '' -ForegroundColor Green
Write-Host '    Last step: Restart Claude Desktop' -ForegroundColor Green
Write-Host '    Then ask it anything about your training!' -ForegroundColor Green
Write-Host '  ===========================================' -ForegroundColor Green
Write-Host ''
Read-Host '  Press Enter to close'
