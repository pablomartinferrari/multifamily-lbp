# Push all changes (new code + test data) to the repo.
#
# Run from a terminal OUTSIDE Cursor (e.g. PowerShell, Windows Terminal):
#   cd C:\dev\etc\multifamily-lbp
#   .\scripts\push-changes.ps1
#
# If you get "index.lock" errors:
#   1. Close Cursor / VS Code completely.
#   2. Delete .git\index.lock manually (File Explorer or: del .git\index.lock).
#   3. Re-run this script.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (Test-Path ".git\index.lock") {
    try {
        Remove-Item -Force ".git\index.lock"
        Write-Host "Removed stale .git\index.lock"
    } catch {
        Write-Host ""
        Write-Host "ERROR: Cannot remove .git\index.lock. Close Cursor/VS Code, delete it manually, then re-run." -ForegroundColor Red
        exit 1
    }
}

$add = git add -A 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $add
    Write-Host "`nGit add failed. Close Cursor, delete .git\index.lock if present, then re-run." -ForegroundColor Red
    exit 1
}

git status

$msg = "feat: 2ETC Jobs API link, layout fixes, rate limiting, v1.3.0, test data"
$commit = git commit -m $msg 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $commit
    exit 1
}

$push = git push 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $push
    exit 1
}

Write-Host "`nDone. Changes pushed to remote." -ForegroundColor Green
