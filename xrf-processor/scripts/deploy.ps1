# XRF Processor - Deployment Script
# ===================================
# This script builds and packages the SPFx solution for production deployment.

param(
    [switch]$SkipClean,
    [switch]$SkipTest,
    [switch]$OpenFolder
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  XRF Processor - Production Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Run this script from the xrf-processor directory." -ForegroundColor Red
    exit 1
}

# Step 1: Install dependencies
Write-Host "[1/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "      Dependencies installed" -ForegroundColor Green

# Step 2: Run tests (optional)
if (-not $SkipTest) {
    Write-Host "[2/5] Running tests..." -ForegroundColor Yellow
    npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Tests failed. Fix tests before deploying." -ForegroundColor Red
        exit 1
    }
    Write-Host "      All tests passed" -ForegroundColor Green
} else {
    Write-Host "[2/5] Skipping tests (--SkipTest)" -ForegroundColor DarkGray
}

# Step 3: Clean previous builds (optional)
if (-not $SkipClean) {
    Write-Host "[3/5] Cleaning previous builds..." -ForegroundColor Yellow
    npx gulp clean
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: gulp clean had issues, continuing..." -ForegroundColor Yellow
    }
    Write-Host "      Clean complete" -ForegroundColor Green
} else {
    Write-Host "[3/5] Skipping clean (--SkipClean)" -ForegroundColor DarkGray
}

# Step 4: Bundle for production
Write-Host "[4/5] Bundling for production..." -ForegroundColor Yellow
npx gulp bundle --ship
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: gulp bundle failed" -ForegroundColor Red
    exit 1
}
Write-Host "      Bundle complete" -ForegroundColor Green

# Step 5: Create package
Write-Host "[5/5] Creating package..." -ForegroundColor Yellow
npx gulp package-solution --ship
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: gulp package-solution failed" -ForegroundColor Red
    exit 1
}
Write-Host "      Package created" -ForegroundColor Green

# Success!
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$packagePath = "sharepoint\solution\xrf-processor.sppkg"
if (Test-Path $packagePath) {
    $fileInfo = Get-Item $packagePath
    Write-Host "Package: $packagePath" -ForegroundColor White
    Write-Host "Size:    $([math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor White
    Write-Host "Created: $($fileInfo.LastWriteTime)" -ForegroundColor White
} else {
    Write-Host "Warning: Package file not found at expected location" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "1. Go to SharePoint Admin Center > More features > Apps > App Catalog" -ForegroundColor White
Write-Host "2. Upload: $packagePath" -ForegroundColor White
Write-Host "3. Check 'Make this solution available to all sites'" -ForegroundColor White
Write-Host "4. Click Deploy" -ForegroundColor White
Write-Host "5. Add web part to a SharePoint page" -ForegroundColor White
Write-Host "6. Configure OpenAI settings in web part properties" -ForegroundColor White
Write-Host ""

# Open folder if requested
if ($OpenFolder) {
    $solutionFolder = "sharepoint\solution"
    if (Test-Path $solutionFolder) {
        explorer.exe $solutionFolder
    }
}
