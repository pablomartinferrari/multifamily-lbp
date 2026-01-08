<#
.SYNOPSIS
    Verifies the SharePoint setup for XRF Processor is complete and functional.

.DESCRIPTION
    This script validates:
    - All three SharePoint artifacts exist (XRF-SourceFiles, XRF-ProcessedResults, XRF-ComponentCache)
    - All required columns are present with correct types
    - Indexed columns are configured properly
    - Performs read/write/delete test to confirm permissions

.PARAMETER SiteUrl
    The SharePoint site URL

.PARAMETER TenantId
    The Azure AD tenant ID

.PARAMETER ClientId
    The application (client) ID from app registration

.PARAMETER ClientSecret
    The client secret value

.PARAMETER SkipWriteTest
    If specified, skips the write/delete permission test

.EXAMPLE
    .\Verify-Setup.ps1

.EXAMPLE
    .\Verify-Setup.ps1 -SkipWriteTest

.NOTES
    Prerequisites:
    - PowerShell 7+
    - PnP.PowerShell module
    - config.ps1 with valid credentials
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

    [switch]$SkipWriteTest
)

$ErrorActionPreference = "Stop"

# Load configuration
$configPath = Join-Path $PSScriptRoot "config.ps1"
if (Test-Path $configPath) {
    . $configPath
    
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
Write-Host "  XRF Processor - Setup Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Track results
$results = @{
    Passed = 0
    Failed = 0
    Warnings = 0
}

function Write-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = "",
        [switch]$IsWarning
    )
    
    if ($IsWarning) {
        Write-Host "  [WARN] $TestName" -ForegroundColor Yellow
        if ($Message) { Write-Host "         $Message" -ForegroundColor Gray }
        $script:results.Warnings++
    } elseif ($Passed) {
        Write-Host "  [PASS] $TestName" -ForegroundColor Green
        if ($Message) { Write-Host "         $Message" -ForegroundColor Gray }
        $script:results.Passed++
    } else {
        Write-Host "  [FAIL] $TestName" -ForegroundColor Red
        if ($Message) { Write-Host "         $Message" -ForegroundColor Gray }
        $script:results.Failed++
    }
}

# Import PnP module
Import-Module PnP.PowerShell -ErrorAction Stop

# Connect to SharePoint
Write-Host "Connecting to SharePoint..." -ForegroundColor Yellow
# Connect using certificate authentication (app-only)
Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Thumbprint $Thumbprint -Tenant $TenantId -WarningAction SilentlyContinue

$web = Get-PnPWeb
Write-Host "Connected to: $($web.Title)`n" -ForegroundColor Green

#region Expected Schema Definition

$expectedSchema = @{
    "XRF-SourceFiles" = @{
        Type = "DocumentLibrary"
        Columns = @(
            @{ Name = "JobNumber"; Type = "Text"; Required = $true }
            @{ Name = "AreaType"; Type = "Choice" }
            @{ Name = "ProcessedStatus"; Type = "Choice" }
            @{ Name = "ProcessedResultsLink"; Type = "URL" }
        )
        IndexedColumns = @()
    }
    "XRF-ProcessedResults" = @{
        Type = "DocumentLibrary"
        Columns = @(
            @{ Name = "JobNumber"; Type = "Text"; Required = $true; Indexed = $true }
            @{ Name = "AreaType"; Type = "Choice" }
            @{ Name = "SourceFileLink"; Type = "URL" }
            @{ Name = "TotalReadings"; Type = "Number" }
            @{ Name = "UniqueComponents"; Type = "Number" }
            @{ Name = "LeadPositiveCount"; Type = "Number" }
            @{ Name = "LeadPositivePercent"; Type = "Number" }
        )
        IndexedColumns = @("JobNumber")
    }
    "XRF-ComponentCache" = @{
        Type = "GenericList"
        Columns = @(
            @{ Name = "NormalizedName"; Type = "Text"; Required = $true }
            @{ Name = "Confidence"; Type = "Number" }
            @{ Name = "Source"; Type = "Choice" }
            @{ Name = "UsageCount"; Type = "Number" }
            @{ Name = "LastUsed"; Type = "DateTime" }
        )
        IndexedColumns = @("Title")
    }
}

#endregion

#region Verify Each List/Library

foreach ($listName in $expectedSchema.Keys) {
    $schema = $expectedSchema[$listName]
    
    Write-Host "--- Checking $listName ---" -ForegroundColor Cyan
    
    # Check if list exists
    $list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
    
    if (-not $list) {
        Write-TestResult -TestName "$listName exists" -Passed $false -Message "List/Library not found"
        continue
    }
    
    # Verify list type
    $isDocLib = $list.BaseTemplate -eq 101
    $expectedDocLib = $schema.Type -eq "DocumentLibrary"
    
    if ($isDocLib -eq $expectedDocLib) {
        Write-TestResult -TestName "$listName exists" -Passed $true -Message "Type: $($schema.Type)"
    } else {
        Write-TestResult -TestName "$listName type" -Passed $false -Message "Expected $($schema.Type), got $($list.BaseTemplate)"
    }
    
    # Check each column
    foreach ($col in $schema.Columns) {
        $field = Get-PnPField -List $listName -Identity $col.Name -ErrorAction SilentlyContinue
        
        if (-not $field) {
            Write-TestResult -TestName "Column: $($col.Name)" -Passed $false -Message "Column not found"
            continue
        }
        
        # Map PnP field types to expected types
        $typeMap = @{
            "Text" = @("Text", "Note")
            "Choice" = @("Choice", "MultiChoice")
            "URL" = @("URL")
            "Number" = @("Number", "Currency")
            "DateTime" = @("DateTime")
        }
        
        $expectedTypes = $typeMap[$col.Type]
        $actualType = $field.TypeAsString
        
        if ($expectedTypes -contains $actualType) {
            $details = "Type: $actualType"
            if ($col.Required -and $field.Required) {
                $details += ", Required"
            } elseif ($col.Required -and -not $field.Required) {
                Write-TestResult -TestName "Column: $($col.Name)" -Passed $true -Message "$details (Note: Not marked required)" -IsWarning
                continue
            }
            Write-TestResult -TestName "Column: $($col.Name)" -Passed $true -Message $details
        } else {
            Write-TestResult -TestName "Column: $($col.Name)" -Passed $false -Message "Expected type $($col.Type), got $actualType"
        }
    }
    
    # Check indexed columns
    foreach ($indexedCol in $schema.IndexedColumns) {
        $field = Get-PnPField -List $listName -Identity $indexedCol -ErrorAction SilentlyContinue
        
        if ($field -and $field.Indexed) {
            Write-TestResult -TestName "Index: $indexedCol" -Passed $true -Message "Column is indexed"
        } else {
            Write-TestResult -TestName "Index: $indexedCol" -Passed $false -Message "Column not indexed (may affect query performance)" -IsWarning
        }
    }
    
    Write-Host ""
}

#endregion

#region Write Permission Test

if (-not $SkipWriteTest) {
    Write-Host "--- Testing Write Permissions ---" -ForegroundColor Cyan
    
    $testListName = "XRF-ComponentCache"
    $testItemTitle = "VERIFICATION-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
    
    try {
        # Create test item
        $testItem = Add-PnPListItem -List $testListName -Values @{
            Title = $testItemTitle
            NormalizedName = "Test Normalized Name"
            Confidence = 0.95
            Source = "Manual"
            UsageCount = 1
        }
        
        if ($testItem) {
            Write-TestResult -TestName "Write test" -Passed $true -Message "Created test item ID: $($testItem.Id)"
            
            # Delete test item
            Remove-PnPListItem -List $testListName -Identity $testItem.Id -Force
            Write-TestResult -TestName "Delete test" -Passed $true -Message "Cleaned up test item"
        }
    } catch {
        Write-TestResult -TestName "Write/Delete test" -Passed $false -Message $_.Exception.Message
    }
    
    Write-Host ""
}

#endregion

#region Summary

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verification Summary" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$totalTests = $results.Passed + $results.Failed + $results.Warnings

if ($results.Failed -eq 0 -and $results.Warnings -eq 0) {
    Write-Host "All $totalTests tests passed! " -ForegroundColor Green -NoNewline
    Write-Host "Setup is complete." -ForegroundColor White
} elseif ($results.Failed -eq 0) {
    Write-Host "Passed: $($results.Passed) | Warnings: $($results.Warnings) | Failed: $($results.Failed)" -ForegroundColor Yellow
    Write-Host "`nSetup is functional but has warnings to review." -ForegroundColor Yellow
} else {
    Write-Host "Passed: $($results.Passed) | Warnings: $($results.Warnings) | Failed: $($results.Failed)" -ForegroundColor Red
    Write-Host "`nSetup has failures. Please run Setup-SharePointLibraries.ps1 to fix." -ForegroundColor Red
}

Write-Host ""

#endregion

# Disconnect
Disconnect-PnPOnline
Write-Host "Disconnected from SharePoint.`n" -ForegroundColor Gray

# Return exit code based on results
if ($results.Failed -gt 0) {
    exit 1
}
exit 0
