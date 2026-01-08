# BB-11: Deployment & Configuration

> **Priority**: 🔵 Final  
> **Estimated Effort**: 2-3 hours  
> **Dependencies**: BB-10  
> **Status**: ✅ Complete

---

## Objective

Package the SPFx solution for production and deploy to SharePoint App Catalog.

---

## Prerequisites

- BB-10 completed (full E2E flow working) ✅
- SharePoint App Catalog access
- OpenAI API key or Azure OpenAI credentials

---

## Quick Deployment

### Option 1: PowerShell Script (Recommended)

```powershell
cd xrf-processor
.\scripts\deploy.ps1
```

Options:
- `.\scripts\deploy.ps1 -SkipTest` - Skip running tests
- `.\scripts\deploy.ps1 -SkipClean` - Skip cleaning previous builds
- `.\scripts\deploy.ps1 -OpenFolder` - Open solution folder after build

### Option 2: Manual Commands

```bash
cd xrf-processor

# Install dependencies
npm install

# Run tests
npm test

# Clean previous builds
npx gulp clean

# Bundle for production
npx gulp bundle --ship

# Create package
npx gulp package-solution --ship
```

Output: `sharepoint/solution/xrf-processor.sppkg`

---

## Deployment Steps

### 1. Upload to App Catalog

1. Go to **SharePoint Admin Center**
2. Navigate to **More features** → **Apps** → **App Catalog**
3. Click **Apps for SharePoint**
4. Upload `xrf-processor.sppkg`
5. ✅ Check **"Make this solution available to all sites"**
6. Click **Deploy**

### 2. Add to SharePoint Site

1. Go to your target SharePoint site
2. **Site Settings** → **Add an app**
3. Find **"xrf-processor-client-side-solution"** and add it
4. Create a new page or edit an existing page
5. Add the **"XRF Lead Paint Processor"** web part

### 3. Configure Web Part

Click the web part's **Edit** (pencil icon) to open the property pane:

| Setting | Description |
|---------|-------------|
| **AI Provider** | Choose "OpenAI" or "Azure OpenAI" |
| **API Key** | Your API key |
| **Model** | `gpt-4o-mini` (OpenAI) or deployment name (Azure) |
| **Azure Endpoint** | (Azure only) `https://your-resource.openai.azure.com` |
| **API Version** | (Azure only) `2024-02-15-preview` |

---

## Configuration Files Updated

### `config/package-solution.json`

```json
{
  "solution": {
    "name": "xrf-processor-client-side-solution",
    "version": "1.0.0.0",
    "includeClientSideAssets": true,
    "skipFeatureDeployment": true,
    "developer": {
      "name": "Multifamily LBP"
    }
  }
}
```

### `XrfProcessorWebPart.manifest.json`

```json
{
  "preconfiguredEntries": [{
    "title": { "default": "XRF Lead Paint Processor" },
    "properties": {
      "openAIProvider": "openai",
      "openAIApiKey": "",
      "openAIModel": "gpt-4o-mini",
      "azureOpenAIEndpoint": "",
      "azureOpenAIApiVersion": "2024-02-15-preview"
    }
  }]
}
```

---

## Security Considerations

### API Key Storage

⚠️ **Current Implementation**: API keys are stored in web part properties.

**For Enhanced Security (Optional):**

1. **Azure Key Vault + Azure Function**
   - Create an Azure Function that proxies OpenAI calls
   - Store API key in Azure Key Vault
   - Function retrieves key from Key Vault
   - SPFx calls Azure Function instead of OpenAI directly

2. **SharePoint Property Bag**
   ```typescript
   // Store (admin only)
   await sp.web.allProperties.set("XRF_OpenAI_Key", "your-key");
   
   // Retrieve
   const props = await sp.web.allProperties();
   const apiKey = props["XRF_OpenAI_Key"];
   ```

---

## Acceptance Criteria

- [x] Package-solution.json configured for production
- [x] Web part manifest includes OpenAI properties
- [x] Property pane allows AI configuration
- [x] Deployment script created
- [x] .sppkg package builds successfully
- [ ] Deployed to App Catalog
- [ ] Web part works on SharePoint page
- [ ] End-to-end test with real data

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Web part not found" | Ensure solution is deployed AND trusted in App Catalog |
| CORS errors | Use SharePoint hosted workbench, not localhost |
| "API key invalid" | Check key in web part properties, ensure no extra spaces |
| Slow AI responses | Normal - GPT calls take 2-5 seconds |
| SharePoint permission errors | Verify user has Contribute access to libraries |

---

## Post-Deployment Checklist

- [ ] Test file upload with real XRF data
- [ ] Verify SharePoint libraries have correct permissions
- [ ] Test AI normalization works
- [ ] Verify summaries save correctly
- [ ] Check All Shots export works
- [ ] Test with different users/permission levels
- [ ] Monitor Azure OpenAI usage/costs

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-08 | Initial release |

