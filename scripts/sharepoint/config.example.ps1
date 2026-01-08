# SharePoint Configuration Template
# Copy this file to config.ps1 and fill in your values
# Do NOT commit config.ps1 to source control

$Config = @{
    # Azure AD / Entra ID Settings
    TenantId       = "your-tenant-id"          # e.g., "contoso.onmicrosoft.com" or GUID
    ClientId       = "your-client-id"          # Application (client) ID from app registration
    ClientSecret   = "your-client-secret"      # Client secret value (not the secret ID)
    
    # SharePoint Settings
    SiteUrl        = "https://yourtenant.sharepoint.com/sites/yoursite"
    
    # App Registration Settings (used by Register-XRFApp.ps1)
    AppDisplayName = "XRF Processor SharePoint App"
}
