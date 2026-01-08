<#
.SYNOPSIS
    Creates SharePoint document libraries and lists for the XRF Processor application.

.DESCRIPTION
    This script creates the following SharePoint artifacts:
    - XRF-SourceFiles: Document library for uploaded Excel files
    - XRF-ProcessedResults: Document library for JSON summaries
    - XRF-ComponentCache: List for AI normalization cache
    
    Uses app-only authentication with client ID and secret.

.PARAMETER SiteUrl
    The SharePoint site URL

.PARAMETER TenantId
    The Azure AD tenant ID

.PARAMETER ClientId
    The application (client) ID from app registration

.PARAMETER ClientSecret
    The client secret value

.PARAMETER SkipExisting
    If specified, skips creation of artifacts that already exist (default: prompt user)

.EXAMPLE
    .\Setup-SharePointLibraries.ps1

.EXAMPLE
    .\Setup-SharePointLibraries.ps1 -SiteUrl "https://contoso.sharepoint.com/sites/xrf" -SkipExisting

.NOTES
    Prerequisites:
    - PowerShell 7+
    - PnP.PowerShell module: Install-Module PnP.PowerShell -Scope CurrentUser
    - App registration with Sites.FullControl.All permission (with admin consent granted)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$SiteUrl,

    [Parameter(Mandatory = $false)]
    [string]$TenantId,

    [Parameter(Mandatory = $false)]
    [string]$ClientId,

    [Parameter(Mandatory = $false)]
    [string]$Thumbprint,

    [switch]$SkipExisting
)

$ErrorActionPreference = "Stop"

# Load configuration
$configPath = Join-Path $PSScriptRoot "config.ps1"
if (Test-Path $configPath) {
    . $configPath
    
    # Use config values if parameters not provided
    if (-not $SiteUrl -and $Config.SiteUrl) { $SiteUrl = $Config.SiteUrl }
    if (-not $TenantId -and $Config.TenantId) { $TenantId = $Config.TenantId }
    if (-not $ClientId -and $Config.ClientId) { $ClientId = $Config.ClientId }
    if (-not $Thumbprint -and $Config.Thumbprint) { $Thumbprint = $Config.Thumbprint }
} else {
    Write-Host "No config.ps1 found. Using parameters only." -ForegroundColor Yellow
}

# Validate required parameters
$missingParams = @()
if (-not $SiteUrl -or $SiteUrl -eq "https://yourtenant.sharepoint.com/sites/yoursite") { $missingParams += "SiteUrl" }
if (-not $TenantId -or $TenantId -eq "your-tenant-id") { $missingParams += "TenantId" }
if (-not $ClientId -or $ClientId -eq "your-client-id") { $missingParams += "ClientId" }
if (-not $Thumbprint -or $Thumbprint -eq "your-certificate-thumbprint") { $missingParams += "Thumbprint" }

if ($missingParams.Count -gt 0) {
    throw "Missing required configuration: $($missingParams -join ', '). Please update config.ps1 or provide as parameters."
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  XRF Processor - SharePoint Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check for PnP.PowerShell module
Write-Host "Checking for PnP.PowerShell module..." -ForegroundColor Yellow
if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "PnP.PowerShell module not found. Installing..." -ForegroundColor Yellow
    Install-Module PnP.PowerShell -Scope CurrentUser -Force -AllowClobber
}

Import-Module PnP.PowerShell -ErrorAction Stop

# Connect to SharePoint
Write-Host "Connecting to SharePoint..." -ForegroundColor Yellow
Write-Host "Site: $SiteUrl" -ForegroundColor Gray

# Connect using certificate authentication (app-only)
Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Thumbprint $Thumbprint -Tenant $TenantId -WarningAction SilentlyContinue

# Verify connection
$web = Get-PnPWeb
Write-Host "Connected to: $($web.Title)" -ForegroundColor Green

#region Helper Functions

function Test-ListExists {
    param([string]$ListName)
    $list = Get-PnPList -Identity $ListName -ErrorAction SilentlyContinue
    return $null -ne $list
}

function Add-FieldIfNotExists {
    param(
        [string]$ListName,
        [string]$DisplayName,
        [string]$InternalName,
        [string]$FieldType,
        [hashtable]$AdditionalParams = @{}
    )
    
    $existingField = Get-PnPField -List $ListName -Identity $InternalName -ErrorAction SilentlyContinue
    if ($existingField) {
        Write-Host "    Field '$DisplayName' already exists, skipping." -ForegroundColor Gray
        return $existingField
    }
    
    $params = @{
        List = $ListName
        DisplayName = $DisplayName
        InternalName = $InternalName
        Type = $FieldType
    }
    
    # Merge additional parameters
    foreach ($key in $AdditionalParams.Keys) {
        $params[$key] = $AdditionalParams[$key]
    }
    
    $field = Add-PnPField @params
    Write-Host "    Added field: $DisplayName ($FieldType)" -ForegroundColor Green
    return $field
}

#endregion

#region Create XRF-SourceFiles Library

$sourceFilesLib = "XRF-SourceFiles"
Write-Host "`n--- Creating $sourceFilesLib ---" -ForegroundColor Cyan

if (Test-ListExists -ListName $sourceFilesLib) {
    Write-Host "$sourceFilesLib already exists." -ForegroundColor Yellow
    if (-not $SkipExisting) {
        $response = Read-Host "Continue and add/verify columns? (y/n)"
        if ($response -ne 'y') {
            Write-Host "Skipping $sourceFilesLib." -ForegroundColor Gray
        }
    }
} else {
    New-PnPList -Title $sourceFilesLib -Template DocumentLibrary | Out-Null
    Write-Host "Created document library: $sourceFilesLib" -ForegroundColor Green
}

# Add columns to XRF-SourceFiles
Write-Host "Adding columns to $sourceFilesLib..." -ForegroundColor Yellow

Add-FieldIfNotExists -ListName $sourceFilesLib -DisplayName "JobNumber" -InternalName "JobNumber" -FieldType "Text" -AdditionalParams @{ Required = $true }

Add-FieldIfNotExists -ListName $sourceFilesLib -DisplayName "AreaType" -InternalName "AreaType" -FieldType "Choice" -AdditionalParams @{ Choices = @("Units", "Common Areas") }

Add-FieldIfNotExists -ListName $sourceFilesLib -DisplayName "ProcessedStatus" -InternalName "ProcessedStatus" -FieldType "Choice" -AdditionalParams @{ Choices = @("Pending", "Complete", "Error") }

# Set default value for ProcessedStatus
$statusField = Get-PnPField -List $sourceFilesLib -Identity "ProcessedStatus" -ErrorAction SilentlyContinue
if ($statusField -and -not $statusField.DefaultValue) {
    Set-PnPField -List $sourceFilesLib -Identity "ProcessedStatus" -Values @{ DefaultValue = "Pending" } | Out-Null
    Write-Host "    Set default value for ProcessedStatus: Pending" -ForegroundColor Green
}

Add-FieldIfNotExists -ListName $sourceFilesLib -DisplayName "ProcessedResultsLink" -InternalName "ProcessedResultsLink" -FieldType "URL"

#endregion

#region Create XRF-ProcessedResults Library

$processedResultsLib = "XRF-ProcessedResults"
Write-Host "`n--- Creating $processedResultsLib ---" -ForegroundColor Cyan

if (Test-ListExists -ListName $processedResultsLib) {
    Write-Host "$processedResultsLib already exists." -ForegroundColor Yellow
    if (-not $SkipExisting) {
        $response = Read-Host "Continue and add/verify columns? (y/n)"
        if ($response -ne 'y') {
            Write-Host "Skipping $processedResultsLib." -ForegroundColor Gray
        }
    }
} else {
    New-PnPList -Title $processedResultsLib -Template DocumentLibrary | Out-Null
    Write-Host "Created document library: $processedResultsLib" -ForegroundColor Green
}

# Add columns to XRF-ProcessedResults
Write-Host "Adding columns to $processedResultsLib..." -ForegroundColor Yellow

Add-FieldIfNotExists -ListName $processedResultsLib -DisplayName "JobNumber" -InternalName "JobNumber" -FieldType "Text" -AdditionalParams @{ Required = $true }

Add-FieldIfNotExists -ListName $processedResultsLib -DisplayName "AreaType" -InternalName "AreaType" -FieldType "Choice" -AdditionalParams @{ Choices = @("Units", "Common Areas") }

Add-FieldIfNotExists -ListName $processedResultsLib -DisplayName "SourceFileLink" -InternalName "SourceFileLink" -FieldType "URL"

Add-FieldIfNotExists -ListName $processedResultsLib -DisplayName "TotalReadings" -InternalName "TotalReadings" -FieldType "Number"

Add-FieldIfNotExists -ListName $processedResultsLib -DisplayName "UniqueComponents" -InternalName "UniqueComponents" -FieldType "Number"

Add-FieldIfNotExists -ListName $processedResultsLib -DisplayName "LeadPositiveCount" -InternalName "LeadPositiveCount" -FieldType "Number"

Add-FieldIfNotExists -ListName $processedResultsLib -DisplayName "LeadPositivePercent" -InternalName "LeadPositivePercent" -FieldType "Number"

# Index JobNumber for faster queries
Write-Host "    Indexing JobNumber column..." -ForegroundColor Yellow
try {
    Set-PnPField -List $processedResultsLib -Identity "JobNumber" -Values @{ Indexed = $true } | Out-Null
    Write-Host "    JobNumber indexed successfully." -ForegroundColor Green
} catch {
    Write-Host "    Could not index JobNumber (may already be indexed): $_" -ForegroundColor Gray
}

#endregion

#region Create XRF-ComponentCache List

$componentCacheList = "XRF-ComponentCache"
Write-Host "`n--- Creating $componentCacheList ---" -ForegroundColor Cyan

if (Test-ListExists -ListName $componentCacheList) {
    Write-Host "$componentCacheList already exists." -ForegroundColor Yellow
    if (-not $SkipExisting) {
        $response = Read-Host "Continue and add/verify columns? (y/n)"
        if ($response -ne 'y') {
            Write-Host "Skipping $componentCacheList." -ForegroundColor Gray
        }
    }
} else {
    New-PnPList -Title $componentCacheList -Template GenericList | Out-Null
    Write-Host "Created list: $componentCacheList" -ForegroundColor Green
}

# Add columns to XRF-ComponentCache
Write-Host "Adding columns to $componentCacheList..." -ForegroundColor Yellow

Add-FieldIfNotExists -ListName $componentCacheList -DisplayName "NormalizedName" -InternalName "NormalizedName" -FieldType "Text" -AdditionalParams @{ Required = $true }

Add-FieldIfNotExists -ListName $componentCacheList -DisplayName "Confidence" -InternalName "Confidence" -FieldType "Number"

Add-FieldIfNotExists -ListName $componentCacheList -DisplayName "Source" -InternalName "Source" -FieldType "Choice" -AdditionalParams @{ Choices = @("AI", "Manual") }

Add-FieldIfNotExists -ListName $componentCacheList -DisplayName "UsageCount" -InternalName "UsageCount" -FieldType "Number"

# Set default value for UsageCount
$usageField = Get-PnPField -List $componentCacheList -Identity "UsageCount" -ErrorAction SilentlyContinue
if ($usageField -and -not $usageField.DefaultValue) {
    Set-PnPField -List $componentCacheList -Identity "UsageCount" -Values @{ DefaultValue = "1" } | Out-Null
    Write-Host "    Set default value for UsageCount: 1" -ForegroundColor Green
}

Add-FieldIfNotExists -ListName $componentCacheList -DisplayName "LastUsed" -InternalName "LastUsed" -FieldType "DateTime"

# Index Title for fast lookups
Write-Host "    Indexing Title column..." -ForegroundColor Yellow
try {
    Set-PnPField -List $componentCacheList -Identity "Title" -Values @{ Indexed = $true } | Out-Null
    Write-Host "    Title indexed successfully." -ForegroundColor Green
} catch {
    Write-Host "    Could not index Title (may already be indexed): $_" -ForegroundColor Gray
}

#endregion

#region Summary

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Created/Verified SharePoint Artifacts:" -ForegroundColor White
Write-Host ""
Write-Host "  $sourceFilesLib (Document Library)" -ForegroundColor Green
Write-Host "    - JobNumber, AreaType, ProcessedStatus, ProcessedResultsLink" -ForegroundColor Gray
Write-Host ""
Write-Host "  $processedResultsLib (Document Library)" -ForegroundColor Green
Write-Host "    - JobNumber (indexed), AreaType, SourceFileLink" -ForegroundColor Gray
Write-Host "    - TotalReadings, UniqueComponents, LeadPositiveCount, LeadPositivePercent" -ForegroundColor Gray
Write-Host ""
Write-Host "  $componentCacheList (List)" -ForegroundColor Green
Write-Host "    - Title (indexed), NormalizedName, Confidence, Source, UsageCount, LastUsed" -ForegroundColor Gray
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Run Verify-Setup.ps1 to confirm everything is configured correctly" -ForegroundColor White
Write-Host "  2. Proceed to BB-03 to implement the SharePoint service in TypeScript" -ForegroundColor White
Write-Host ""

#endregion

# Disconnect
Disconnect-PnPOnline
Write-Host "Disconnected from SharePoint.`n" -ForegroundColor Gray
