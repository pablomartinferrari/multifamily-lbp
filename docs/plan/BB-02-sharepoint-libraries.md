# BB-02: SharePoint Libraries Setup

> **Priority**: 🔴 Critical  
> **Estimated Effort**: 1-2 hours  
> **Dependencies**: BB-01 (SPFx Setup)  
> **Status**: ✅ Complete

---

## Objective

Create the SharePoint document libraries and lists required for storing XRF data, processed results, and AI normalization cache.

---

## Prerequisites

- SharePoint site available
- Site Owner or Admin permissions
- BB-01 completed (SPFx project created)

---

## SharePoint Artifacts to Create

| Artifact | Type | Purpose |
|----------|------|---------|
| XRF-SourceFiles | Document Library | Store uploaded Excel files |
| XRF-ProcessedResults | Document Library | Store JSON summaries |
| XRF-ComponentCache | List | Cache AI normalizations |

---

## Tasks

### 1. Create XRF-SourceFiles Library

**Via SharePoint UI:**
1. Go to Site Contents → New → Document Library
2. Name: `XRF-SourceFiles`
3. Click Create

**Add Custom Columns:**

| Column Name | Type | Settings |
|-------------|------|----------|
| JobNumber | Single line of text | Required |
| AreaType | Choice | Choices: `Units`, `Common Areas` |
| ProcessedStatus | Choice | Choices: `Pending`, `Complete`, `Error`; Default: `Pending` |
| ProcessedResultsLink | Hyperlink | Format: Hyperlink |

**Via PowerShell (PnP):**
```powershell
# Connect to site
Connect-PnPOnline -Url "https://[tenant].sharepoint.com/sites/[site]" -Interactive

# Create library
New-PnPList -Title "XRF-SourceFiles" -Template DocumentLibrary

# Add columns
Add-PnPField -List "XRF-SourceFiles" -DisplayName "JobNumber" -InternalName "JobNumber" -Type Text -Required
Add-PnPField -List "XRF-SourceFiles" -DisplayName "AreaType" -InternalName "AreaType" -Type Choice -Choices "Units","Common Areas"
Add-PnPField -List "XRF-SourceFiles" -DisplayName "ProcessedStatus" -InternalName "ProcessedStatus" -Type Choice -Choices "Pending","Complete","Error"
Add-PnPField -List "XRF-SourceFiles" -DisplayName "ProcessedResultsLink" -InternalName "ProcessedResultsLink" -Type URL
```

---

### 2. Create XRF-ProcessedResults Library

**Via SharePoint UI:**
1. Go to Site Contents → New → Document Library
2. Name: `XRF-ProcessedResults`
3. Click Create

**Add Custom Columns:**

| Column Name | Type | Settings |
|-------------|------|----------|
| JobNumber | Single line of text | Required, Add to default view, Index this column |
| AreaType | Choice | Choices: `Units`, `Common Areas` |
| SourceFileLink | Hyperlink | Format: Hyperlink |
| TotalReadings | Number | Decimal places: 0 |
| UniqueComponents | Number | Decimal places: 0 |
| LeadPositiveCount | Number | Decimal places: 0 |
| LeadPositivePercent | Number | Decimal places: 1 |

**Via PowerShell (PnP):**
```powershell
# Create library
New-PnPList -Title "XRF-ProcessedResults" -Template DocumentLibrary

# Add columns
Add-PnPField -List "XRF-ProcessedResults" -DisplayName "JobNumber" -InternalName "JobNumber" -Type Text -Required
Add-PnPField -List "XRF-ProcessedResults" -DisplayName "AreaType" -InternalName "AreaType" -Type Choice -Choices "Units","Common Areas"
Add-PnPField -List "XRF-ProcessedResults" -DisplayName "SourceFileLink" -InternalName "SourceFileLink" -Type URL
Add-PnPField -List "XRF-ProcessedResults" -DisplayName "TotalReadings" -InternalName "TotalReadings" -Type Number
Add-PnPField -List "XRF-ProcessedResults" -DisplayName "UniqueComponents" -InternalName "UniqueComponents" -Type Number
Add-PnPField -List "XRF-ProcessedResults" -DisplayName "LeadPositiveCount" -InternalName "LeadPositiveCount" -Type Number
Add-PnPField -List "XRF-ProcessedResults" -DisplayName "LeadPositivePercent" -InternalName "LeadPositivePercent" -Type Number

# Index JobNumber for faster queries
Set-PnPField -List "XRF-ProcessedResults" -Identity "JobNumber" -Values @{Indexed=$true}
```

---

### 3. Create XRF-ComponentCache List

**Via SharePoint UI:**
1. Go to Site Contents → New → List
2. Name: `XRF-ComponentCache`
3. Click Create

**Add Custom Columns:**

| Column Name | Type | Settings |
|-------------|------|----------|
| NormalizedName | Single line of text | Required |
| Confidence | Number | Decimal places: 2, Min: 0, Max: 1 |
| Source | Choice | Choices: `AI`, `Manual` |
| UsageCount | Number | Decimal places: 0, Default: 1 |
| LastUsed | Date and Time | Include time: No |

**Note:** The `Title` column will store the original component name (indexed for fast lookups).

**Via PowerShell (PnP):**
```powershell
# Create list
New-PnPList -Title "XRF-ComponentCache" -Template GenericList

# Add columns
Add-PnPField -List "XRF-ComponentCache" -DisplayName "NormalizedName" -InternalName "NormalizedName" -Type Text -Required
Add-PnPField -List "XRF-ComponentCache" -DisplayName "Confidence" -InternalName "Confidence" -Type Number
Add-PnPField -List "XRF-ComponentCache" -DisplayName "Source" -InternalName "Source" -Type Choice -Choices "AI","Manual"
Add-PnPField -List "XRF-ComponentCache" -DisplayName "UsageCount" -InternalName "UsageCount" -Type Number
Add-PnPField -List "XRF-ComponentCache" -DisplayName "LastUsed" -InternalName "LastUsed" -Type DateTime

# Index Title for fast lookups
Set-PnPField -List "XRF-ComponentCache" -Identity "Title" -Values @{Indexed=$true}
```

---

### 4. Verify Setup

Run this verification script or manually check:

```powershell
# Verify libraries exist
Get-PnPList | Where-Object { $_.Title -like "XRF-*" } | Select-Object Title, ItemCount

# Verify columns on each list
Get-PnPField -List "XRF-SourceFiles" | Select-Object Title, InternalName, TypeAsString
Get-PnPField -List "XRF-ProcessedResults" | Select-Object Title, InternalName, TypeAsString
Get-PnPField -List "XRF-ComponentCache" | Select-Object Title, InternalName, TypeAsString
```

---

### 5. Re-run BB-01 Connection Test

Go back to your SPFx web part and run the connection test again. Now the write test should pass:

```
✅ Read successful - Web title: [Your Site]
✅ Found X lists
✅ Write successful - Item ID: 1
✅ Delete successful
```

---

## Acceptance Criteria

- [ ] XRF-SourceFiles library exists with all columns
- [ ] XRF-ProcessedResults library exists with all columns
- [ ] XRF-ComponentCache list exists with all columns
- [ ] JobNumber column is indexed on XRF-ProcessedResults
- [ ] Title column is indexed on XRF-ComponentCache
- [ ] BB-01 connection test passes (including write test)

---

## Output Artifacts

| SharePoint Artifact | Columns |
|---------------------|---------|
| XRF-SourceFiles | Title, JobNumber, AreaType, ProcessedStatus, ProcessedResultsLink |
| XRF-ProcessedResults | Title, JobNumber, AreaType, SourceFileLink, TotalReadings, UniqueComponents, LeadPositiveCount, LeadPositivePercent |
| XRF-ComponentCache | Title, NormalizedName, Confidence, Source, UsageCount, LastUsed |

---

## Column Reference (Internal Names)

When accessing via PnP JS, use these internal names:

```typescript
// XRF-SourceFiles
interface ISourceFileItem {
  Id: number;
  Title: string;           // File name
  JobNumber: string;
  AreaType: string;        // "Units" | "Common Areas"
  ProcessedStatus: string; // "Pending" | "Complete" | "Error"
  ProcessedResultsLink?: { Url: string; Description: string };
}

// XRF-ProcessedResults
interface IProcessedResultItem {
  Id: number;
  Title: string;           // Summary file name
  JobNumber: string;
  AreaType: string;
  SourceFileLink?: { Url: string; Description: string };
  TotalReadings: number;
  UniqueComponents: number;
  LeadPositiveCount: number;
  LeadPositivePercent: number;
}

// XRF-ComponentCache
interface IComponentCacheItem {
  Id: number;
  Title: string;           // Original component name
  NormalizedName: string;  // Canonical name
  Confidence: number;      // 0-1
  Source: string;          // "AI" | "Manual"
  UsageCount: number;
  LastUsed: Date;
}
```

---

## Next Steps

Once this building block is complete:
1. ➡️ Proceed to **BB-03: SharePoint Service (PnP JS)**
2. The service will implement CRUD operations for these libraries



