Write-Host "=== Claude Config Finder ===" -ForegroundColor Cyan

# Check all known locations
$locations = @(
    "$env:APPDATA\Claude",
    "$env:LOCALAPPDATA\AnthropicClaude",
    "$env:APPDATA\AnthropicClaude"
)

# Check Microsoft Store packages
$storePkgs = Get-ChildItem "$env:LOCALAPPDATA\Packages" -Filter "Claude_*" -Directory -ErrorAction SilentlyContinue
foreach ($pkg in $storePkgs) {
    $locations += "$($pkg.FullName)\LocalCache\Roaming\Claude"
    Write-Host "Found Store package: $($pkg.FullName)" -ForegroundColor Green
}

Write-Host "`nChecking locations:"
foreach ($loc in $locations) {
    $exists = Test-Path $loc
    Write-Host "  [$( if($exists){'EXISTS'}else{'------'} )]  $loc"
}

Write-Host "`nAll Claude-related folders on this machine:"
Get-ChildItem "$env:APPDATA" -Filter "*claude*" -Directory -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  APPDATA: $_" }
Get-ChildItem "$env:LOCALAPPDATA" -Filter "*claude*" -Directory -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  LOCALAPPDATA: $_" }
Get-ChildItem "$env:LOCALAPPDATA" -Filter "*anthropic*" -Directory -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  LOCALAPPDATA: $_" }

Write-Host "`nDone." -ForegroundColor Cyan
Read-Host "Press Enter to close"
