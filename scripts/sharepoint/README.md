# SharePoint Setup Scripts

PowerShell scripts for setting up SharePoint document libraries and lists required by the XRF Processor application.

## Prerequisites

- **PowerShell 7+** - [Install PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell)
- **PnP.PowerShell module** - For SharePoint operations
- **Microsoft.Graph module** - For app registration (optional)
- **Azure AD permissions** - Application Administrator or Global Administrator role

### Install Required Modules

```powershell
# Install PnP.PowerShell
Install-Module PnP.PowerShell -Scope CurrentUser -Force

# Install Microsoft.Graph (for app registration script)
Install-Module Microsoft.Graph -Scope CurrentUser -Force
```

## Quick Start

### 1. Register Azure AD App (First Time Only)

```powershell
# Run the app registration script
.\Register-XRFApp.ps1 -TenantId "yourtenant.onmicrosoft.com"
```

This will:
- Create an Azure AD app registration with required permissions
- Generate a client secret (valid for 12 months)
- Output the credentials you need for `config.ps1`

**Important:** After running, you must grant admin consent in Azure Portal:
1. Go to Azure Portal → App Registrations → XRF Processor SharePoint App
2. Click API Permissions → Grant admin consent

### 2. Configure Credentials

```powershell
# Copy the example config
Copy-Item config.example.ps1 config.ps1

# Edit config.ps1 with your values
notepad config.ps1
```

Fill in the values from step 1:
```powershell
$Config = @{
    TenantId     = "your-tenant-id"
    ClientId     = "your-client-id"
    ClientSecret = "your-client-secret"
    SiteUrl      = "https://yourtenant.sharepoint.com/sites/yoursite"
}
```

### 3. Create SharePoint Artifacts

```powershell
.\Setup-SharePointLibraries.ps1
```

This creates:
- **XRF-SourceFiles** - Document library for uploaded Excel files
- **XRF-ProcessedResults** - Document library for JSON summaries
- **XRF-ComponentCache** - List for AI component normalization cache
- **XRF-SubstrateCache** - List for AI substrate normalization cache

### 4. Verify Setup

```powershell
.\Verify-Setup.ps1
```

Expected output:
```
[PASS] XRF-SourceFiles exists
[PASS] Column: JobNumber
[PASS] Column: AreaType
...
[PASS] Write test
[PASS] Delete test

All tests passed! Setup is complete.
```

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `Register-XRFApp.ps1` | Creates Azure AD app registration with required API permissions |
| `Setup-SharePointLibraries.ps1` | Creates SharePoint document libraries and lists with columns |
| `Verify-Setup.ps1` | Validates the setup and tests read/write permissions |
| `config.example.ps1` | Template for configuration values |

## API Permissions

The app registration requires these **Application** permissions:

| API | Permission | Purpose |
|-----|------------|---------|
| SharePoint | Sites.FullControl.All | Create/manage lists and libraries |
| Microsoft Graph | Sites.ReadWrite.All | Read/write site content |
| Microsoft Graph | Files.ReadWrite.All | Upload/download files |

## SharePoint Artifacts

### XRF-SourceFiles (Document Library)

Stores uploaded Excel files with XRF readings.

| Column | Type | Notes |
|--------|------|-------|
| Title | Text | File name (built-in) |
| JobNumber | Text | Required |
| AreaType | Choice | Units, Common Areas |
| ProcessedStatus | Choice | Pending (default), Complete, Error |
| ProcessedResultsLink | URL | Link to processed results |

### XRF-ProcessedResults (Document Library)

Stores JSON summary files after processing.

| Column | Type | Notes |
|--------|------|-------|
| Title | Text | Summary file name (built-in) |
| JobNumber | Text | Required, **Indexed** |
| AreaType | Choice | Units, Common Areas |
| SourceFileLink | URL | Link to source Excel file |
| TotalReadings | Number | Count of XRF readings |
| UniqueComponents | Number | Count of unique components |
| LeadPositiveCount | Number | Components with lead detected |
| LeadPositivePercent | Number | Percentage with lead |

### XRF-ComponentCache (List)

Caches AI-normalized component names for performance.

| Column | Type | Notes |
|--------|------|-------|
| Title | Text | Original component name, **Indexed** |
| NormalizedName | Text | Required, canonical name |
| Confidence | Number | AI confidence 0-1 |
| Source | Choice | AI, Manual |
| UsageCount | Number | Default: 1 |
| LastUsed | DateTime | Last access timestamp |

### XRF-SubstrateCache (List)

Caches AI-normalized substrate (surface material) names for performance.

| Column | Type | Notes |
|--------|------|-------|
| Title | Text | Original substrate name, **Indexed** |
| NormalizedName | Text | Required, canonical name |
| Confidence | Number | AI confidence 0-1 |
| Source | Choice | AI, Manual |
| UsageCount | Number | Default: 1 |
| LastUsed | DateTime | Last access timestamp |

## Troubleshooting

### "Access denied" or permission errors

1. Ensure admin consent was granted for the app
2. Verify the app has Sites.FullControl.All permission
3. Check that the user running the script has Site Owner permissions

### "List already exists" messages

This is normal if re-running the script. The script will:
- Skip creating existing lists/libraries
- Add any missing columns
- Prompt before making changes

Use `-SkipExisting` to suppress prompts:
```powershell
.\Setup-SharePointLibraries.ps1 -SkipExisting
```

### Module not found errors

```powershell
# Update modules
Update-Module PnP.PowerShell -Force
Update-Module Microsoft.Graph -Force
```

### Client secret expired

Run the registration script again to create a new secret:
```powershell
.\Register-XRFApp.ps1 -TenantId "yourtenant.onmicrosoft.com"
```

## Security Notes

- **Never commit `config.ps1`** - Add it to `.gitignore`
- **Rotate secrets regularly** - Default expiry is 12 months
- **Use certificate auth in production** - More secure than client secrets
- **Delete `app-registration-output.txt`** after copying credentials

## Next Steps

After completing SharePoint setup:
1. Run the SPFx connection test (BB-01) to verify web part connectivity
2. Proceed to BB-03 to implement the TypeScript SharePoint service
