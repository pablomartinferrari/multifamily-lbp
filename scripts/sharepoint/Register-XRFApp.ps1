<#
.SYNOPSIS
    Registers an Azure AD (Entra ID) application for XRF Processor SharePoint operations.

.DESCRIPTION
    This script creates an Azure AD app registration with the following permissions:
    - SharePoint: Sites.FullControl.All (Application)
    - Microsoft Graph: Sites.ReadWrite.All (Application)
    - Microsoft Graph: Files.ReadWrite.All (Application)
    
    It also creates a client secret for authentication.

.PARAMETER TenantId
    The Azure AD tenant ID or domain (e.g., "contoso.onmicrosoft.com")

.PARAMETER AppDisplayName
    The display name for the app registration (default: "XRF Processor SharePoint App")

.PARAMETER SecretExpiryMonths
    Number of months until the client secret expires (default: 12)

.EXAMPLE
    .\Register-XRFApp.ps1 -TenantId "contoso.onmicrosoft.com"

.EXAMPLE
    .\Register-XRFApp.ps1 -TenantId "your-tenant-guid" -AppDisplayName "My XRF App" -SecretExpiryMonths 24

.NOTES
    Prerequisites:
    - PowerShell 7+
    - Microsoft.Graph PowerShell module: Install-Module Microsoft.Graph -Scope CurrentUser
    - Azure AD Global Administrator or Application Administrator role
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$TenantId,

    [Parameter(Mandatory = $false)]
    [string]$AppDisplayName = "XRF Processor SharePoint App",

    [Parameter(Mandatory = $false)]
    [int]$SecretExpiryMonths = 12
)

$ErrorActionPreference = "Stop"

# Load config if available and parameters not provided
$configPath = Join-Path $PSScriptRoot "config.ps1"
if (Test-Path $configPath) {
    . $configPath
    if (-not $TenantId -and $Config.TenantId -and $Config.TenantId -ne "your-tenant-id") {
        $TenantId = $Config.TenantId
    }
    if ($AppDisplayName -eq "XRF Processor SharePoint App" -and $Config.AppDisplayName) {
        $AppDisplayName = $Config.AppDisplayName
    }
}

if (-not $TenantId) {
    throw "TenantId is required. Provide it as a parameter or set it in config.ps1"
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  XRF Processor - App Registration" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check for Microsoft.Graph module
Write-Host "Checking for Microsoft.Graph module..." -ForegroundColor Yellow
if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Applications)) {
    Write-Host "Microsoft.Graph module not found. Installing..." -ForegroundColor Yellow
    Install-Module Microsoft.Graph -Scope CurrentUser -Force -AllowClobber
}

# Import required modules
Import-Module Microsoft.Graph.Applications -ErrorAction Stop

# Connect to Microsoft Graph
Write-Host "`nConnecting to Microsoft Graph..." -ForegroundColor Yellow
Write-Host "You will be prompted to sign in with an account that has Application Administrator permissions.`n" -ForegroundColor Gray

Connect-MgGraph -TenantId $TenantId -Scopes "Application.ReadWrite.All", "AppRoleAssignment.ReadWrite.All" -NoWelcome

# Verify connection
$context = Get-MgContext
if (-not $context) {
    throw "Failed to connect to Microsoft Graph"
}
Write-Host "Connected to tenant: $($context.TenantId)" -ForegroundColor Green

# Define required API permissions
# Microsoft Graph API ID: 00000003-0000-0000-c000-000000000000
# SharePoint API ID: 00000003-0000-0ff1-ce00-000000000000

$graphApiId = "00000003-0000-0000-c000-000000000000"
$sharePointApiId = "00000003-0000-0ff1-ce00-000000000000"

# Permission IDs (Application permissions - Role type)
$permissions = @{
    # Microsoft Graph
    "Sites.ReadWrite.All" = @{
        ApiId = $graphApiId
        Id = "9492366f-7969-46a4-8d15-ed1a20078fff"  # Sites.ReadWrite.All
        Type = "Role"
    }
    "Files.ReadWrite.All" = @{
        ApiId = $graphApiId
        Id = "01d4889c-1287-42c6-ac1f-5d1e02578ef6"  # Files.ReadWrite.All
        Type = "Role"
    }
    # SharePoint
    "SharePoint.Sites.FullControl.All" = @{
        ApiId = $sharePointApiId
        Id = "678536fe-1083-478a-9c59-b99265e6b0d3"  # Sites.FullControl.All
        Type = "Role"
    }
}

# Build required resource access
$requiredResourceAccess = @(
    @{
        ResourceAppId = $graphApiId
        ResourceAccess = @(
            @{ Id = $permissions["Sites.ReadWrite.All"].Id; Type = "Role" }
            @{ Id = $permissions["Files.ReadWrite.All"].Id; Type = "Role" }
        )
    }
    @{
        ResourceAppId = $sharePointApiId
        ResourceAccess = @(
            @{ Id = $permissions["SharePoint.Sites.FullControl.All"].Id; Type = "Role" }
        )
    }
)

# Check if app already exists
Write-Host "`nChecking if app '$AppDisplayName' already exists..." -ForegroundColor Yellow
$existingApp = Get-MgApplication -Filter "displayName eq '$AppDisplayName'" -ErrorAction SilentlyContinue

if ($existingApp) {
    Write-Host "App '$AppDisplayName' already exists with ID: $($existingApp.AppId)" -ForegroundColor Yellow
    $response = Read-Host "Do you want to update it and create a new secret? (y/n)"
    if ($response -ne 'y') {
        Write-Host "Exiting without changes." -ForegroundColor Gray
        Disconnect-MgGraph
        exit 0
    }
    $app = $existingApp
    
    # Update permissions
    Update-MgApplication -ApplicationId $app.Id -RequiredResourceAccess $requiredResourceAccess
    Write-Host "Updated API permissions." -ForegroundColor Green
} else {
    # Create new app registration
    Write-Host "`nCreating app registration '$AppDisplayName'..." -ForegroundColor Yellow
    
    $appParams = @{
        DisplayName = $AppDisplayName
        SignInAudience = "AzureADMyOrg"
        RequiredResourceAccess = $requiredResourceAccess
    }
    
    $app = New-MgApplication @appParams
    Write-Host "Created app registration with ID: $($app.AppId)" -ForegroundColor Green
}

# Create client secret
Write-Host "`nCreating client secret (expires in $SecretExpiryMonths months)..." -ForegroundColor Yellow

$secretParams = @{
    PasswordCredential = @{
        DisplayName = "XRF Processor Secret - $(Get-Date -Format 'yyyy-MM-dd')"
        EndDateTime = (Get-Date).AddMonths($SecretExpiryMonths)
    }
}

$secret = Add-MgApplicationPassword -ApplicationId $app.Id -BodyParameter $secretParams
Write-Host "Created client secret." -ForegroundColor Green

# Create service principal if it doesn't exist
Write-Host "`nEnsuring service principal exists..." -ForegroundColor Yellow
$sp = Get-MgServicePrincipal -Filter "appId eq '$($app.AppId)'" -ErrorAction SilentlyContinue
if (-not $sp) {
    $sp = New-MgServicePrincipal -AppId $app.AppId
    Write-Host "Created service principal." -ForegroundColor Green
} else {
    Write-Host "Service principal already exists." -ForegroundColor Green
}

# Output results
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  App Registration Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Copy these values to your config.ps1 file:" -ForegroundColor Yellow
Write-Host ""
Write-Host "TenantId     = `"$($context.TenantId)`"" -ForegroundColor White
Write-Host "ClientId     = `"$($app.AppId)`"" -ForegroundColor White
Write-Host "ClientSecret = `"$($secret.SecretText)`"" -ForegroundColor White
Write-Host ""

# Important reminder about admin consent
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  IMPORTANT: Admin Consent Required!" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "You must grant admin consent for the API permissions." -ForegroundColor White
Write-Host "Go to Azure Portal -> App Registrations -> $AppDisplayName -> API Permissions" -ForegroundColor Gray
Write-Host "Then click 'Grant admin consent for [your tenant]'" -ForegroundColor Gray
Write-Host ""
Write-Host "Or use this URL:" -ForegroundColor White
$consentUrl = "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$($app.AppId)"
Write-Host $consentUrl -ForegroundColor Cyan
Write-Host ""

# Save to file for reference
$outputFile = Join-Path $PSScriptRoot "app-registration-output.txt"
@"
XRF Processor App Registration
==============================
Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

TenantId     = $($context.TenantId)
ClientId     = $($app.AppId)
ClientSecret = $($secret.SecretText)

Secret Expiry: $(($secret.EndDateTime).ToString('yyyy-MM-dd'))

IMPORTANT: Grant admin consent at:
$consentUrl

API Permissions Required:
- SharePoint: Sites.FullControl.All
- Microsoft Graph: Sites.ReadWrite.All
- Microsoft Graph: Files.ReadWrite.All
"@ | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "Credentials saved to: $outputFile" -ForegroundColor Gray
Write-Host "(Delete this file after copying values to config.ps1)" -ForegroundColor Gray
Write-Host ""

# Disconnect
Disconnect-MgGraph
Write-Host "Disconnected from Microsoft Graph.`n" -ForegroundColor Gray
