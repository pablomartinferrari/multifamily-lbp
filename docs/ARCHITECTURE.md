# XRF Lead Paint Inspection Processor - Architecture Document

> **Related Documents:**
>
> - [REQUIREMENTS.md](./REQUIREMENTS.md) - Business logic, data models, summary rules
> - [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Building blocks and tasks (TBD)

---

## 1. Solution Overview

An SPFx (SharePoint Framework) web part for processing XRF lead paint inspection data with AI-powered component normalization.

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              SharePoint Site                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                       SPFx Web Part (React)                                │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐    │  │
│  │  │  File Upload    │  │  Job Metadata   │  │  Processing Status      │    │  │
│  │  │  Component      │  │  Form           │  │  & Results View         │    │  │
│  │  │  (.xlsx input)  │  │  - Job Number   │  │  - Progress             │    │  │
│  │  │                 │  │  - Area Type    │  │  - AI Suggestions       │    │  │
│  │  └────────┬────────┘  └────────┬────────┘  │  - Summary Preview      │    │  │
│  │           │                    │           └────────────┬────────────┘    │  │
│  │           └────────────────────┼────────────────────────┘                 │  │
│  │                                ▼                                           │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                       Processing Pipeline                             │ │  │
│  │  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌───────────┐ │ │  │
│  │  │  │ Excel Parser│   │    Data     │   │     AI      │   │  Summary  │ │ │  │
│  │  │  │  (SheetJS)  │──▶│  Validator  │──▶│ Normalizer  │──▶│ Generator │ │ │  │
│  │  │  └─────────────┘   └─────────────┘   └──────┬──────┘   └───────────┘ │ │  │
│  │  └─────────────────────────────────────────────┼────────────────────────┘ │  │
│  └────────────────────────────────────────────────┼──────────────────────────┘  │
│                                                   │                              │
│                          ┌────────────────────────┼────────────────────────┐    │
│                          │         Azure          ▼                        │    │
│                          │    ┌───────────────────────────────────────┐   │    │
│                          │    │         Azure OpenAI Service          │   │    │
│                          │    │  • GPT-4 / GPT-3.5 Chat Completion    │   │    │
│                          │    │  • Semantic component matching        │   │    │
│                          │    └───────────────────────────────────────┘   │    │
│                          └─────────────────────────────────────────────────┘    │
│                                                   │                              │
│  ┌────────────────────────────────────────────────┼──────────────────────────┐  │
│  │                     SharePoint Storage         ▼                          │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐    │  │
│  │  │  Source Files    │  │ Processed Results│  │  Component Cache     │    │  │
│  │  │  Library         │  │ Library          │  │  List                │    │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer                | Technology                        | Purpose                            |
| -------------------- | --------------------------------- | ---------------------------------- |
| **Framework**        | SharePoint Framework (SPFx) 1.18+ | SharePoint-native development      |
| **UI Library**       | React 17+                         | Component-based UI                 |
| **UI Components**    | Fluent UI React (v8)              | Microsoft design system compliance |
| **SP Controls**      | @pnp/spfx-controls-react          | File upload, pickers, etc.         |
| **SP Data Access**   | @pnp/sp (PnPJS)                   | SharePoint REST API wrapper        |
| **Excel Parsing**    | SheetJS (xlsx)                    | Client-side Excel file reading     |
| **AI Services**      | Azure OpenAI (GPT-4 / GPT-3.5)    | Component name normalization       |
| **State Management** | React Context or useState         | Local component state              |
| **Build Tools**      | Gulp, Webpack (SPFx default)      | Bundling and deployment            |

---

## 3. Project Structure

```
src/
├── webparts/
│   └── xrfProcessor/
│       ├── XrfProcessorWebPart.ts              # Web part entry point
│       ├── XrfProcessorWebPart.manifest.json
│       │
│       └── components/
│           ├── XrfProcessor.tsx                # Main container
│           ├── XrfProcessor.module.scss
│           │
│           ├── FileUpload/
│           │   ├── FileUpload.tsx              # Excel file upload UI
│           │   └── FileUpload.module.scss
│           │
│           ├── JobMetadataForm/
│           │   ├── JobMetadataForm.tsx         # Job number, area type
│           │   └── JobMetadataForm.module.scss
│           │
│           ├── ProcessingStatus/
│           │   ├── ProcessingStatus.tsx        # Progress display
│           │   └── ProcessingStatus.module.scss
│           │
│           ├── AINormalizationReview/
│           │   ├── AINormalizationReview.tsx   # AI suggestions modal
│           │   ├── NormalizationCard.tsx       # Individual suggestion
│           │   └── AINormalizationReview.module.scss
│           │
│           └── ResultsSummary/
│               ├── ResultsSummary.tsx          # Summary display
│               └── ResultsSummary.module.scss
│
├── services/
│   ├── ExcelParserService.ts                   # SheetJS wrapper
│   ├── DataTransformService.ts                 # Validation/transform
│   ├── AzureOpenAIService.ts                   # AI API client
│   ├── ComponentNormalizerService.ts           # AI + caching orchestration
│   ├── SummaryService.ts                       # Summary generation
│   └── SharePointService.ts                    # PnP JS operations
│
├── models/
│   ├── IXrfReading.ts                          # XRF data row
│   ├── IJobMetadata.ts                         # Job info
│   ├── IProcessedSummary.ts                    # Summary output
│   ├── IComponentSummary.ts                    # Per-component stats
│   ├── INormalizationResult.ts                 # AI response
│   └── IComponentMapping.ts                    # Cache entry
│
└── constants/
    ├── LeadThresholds.ts                       # Business rule constants
    └── LibraryNames.ts                         # SharePoint library names
```

---

## 4. Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA PROCESSING FLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. UPLOAD                                                              │
│     ├─ User selects .xlsx file                                          │
│     ├─ User enters Job Number                                           │
│     └─ User selects: "Units" or "Common Areas"                          │
│                           │                                             │
│                           ▼                                             │
│  2. PARSE (ExcelParserService)                                          │
│     ├─ SheetJS reads file buffer                                        │
│     ├─ Extract rows from worksheet                                      │
│     └─ Map to IXrfReading[]                                             │
│                           │                                             │
│                           ▼                                             │
│  3. VALIDATE (DataTransformService)                                     │
│     ├─ Check required fields present                                    │
│     ├─ Validate data types                                              │
│     ├─ Calculate isPositive (leadContent >= 1.0)                        │
│     └─ Flag anomalies                                                   │
│                           │                                             │
│                           ▼                                             │
│  4. NORMALIZE (ComponentNormalizerService)                              │
│     ├─ Extract unique component names                                   │
│     ├─ Check SharePoint cache for known mappings                        │
│     ├─ Send unknown names to Azure OpenAI                               │
│     ├─ Present suggestions to user for review                           │
│     ├─ Apply approved normalizations                                    │
│     └─ Update cache with new mappings                                   │
│                           │                                             │
│                           ▼                                             │
│  5. SUMMARIZE (SummaryService)                                          │
│     ├─ Group by normalized component                                    │
│     ├─ Apply classification rules (Average/Uniform/Non-Uniform)         │
│     └─ Generate IJobSummary                                             │
│                           │                                             │
│                           ▼                                             │
│  6. STORE (SharePointService)                                           │
│     ├─ Upload original .xlsx to Source Files Library                    │
│     ├─ Save summary JSON to Processed Results Library                   │
│     └─ Update metadata columns                                          │
│                           │                                             │
│                           ▼                                             │
│  7. DISPLAY                                                             │
│     └─ Render summary tables in ResultsSummary component                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. SharePoint Configuration

### 5.1 Source Files Library: `XRF-SourceFiles`

| Column Name          | Type                            | Purpose                  |
| -------------------- | ------------------------------- | ------------------------ |
| Title                | Single line text                | File name                |
| JobNumber            | Single line text                | Job identifier           |
| AreaType             | Choice (Units/Common Areas)     | Dataset type             |
| UploadedDate         | Date/Time                       | Upload timestamp         |
| ProcessedStatus      | Choice (Pending/Complete/Error) | Processing status        |
| ProcessedResultsLink | Hyperlink                       | Link to processed output |

### 5.2 Processed Results Library: `XRF-ProcessedResults`

| Column Name         | Type             | Purpose                  |
| ------------------- | ---------------- | ------------------------ |
| Title               | Single line text | Summary file name        |
| JobNumber           | Single line text | Job identifier (indexed) |
| AreaType            | Choice           | Units or Common Areas    |
| ProcessedDate       | Date/Time        | Processing timestamp     |
| SourceFileLink      | Hyperlink        | Link to original file    |
| TotalReadings       | Number           | Count of XRF readings    |
| UniqueComponents    | Number           | Distinct components      |
| LeadPositiveCount   | Number           | Readings >= threshold    |
| LeadPositivePercent | Number           | % positive results       |

### 5.3 Component Normalization Cache: `XRF-ComponentCache` (List)

| Column Name    | Type               | Purpose                           |
| -------------- | ------------------ | --------------------------------- |
| Title          | Single line text   | Original component name (indexed) |
| NormalizedName | Single line text   | Canonical name                    |
| Confidence     | Number             | AI confidence (0-1)               |
| Source         | Choice (AI/Manual) | How mapping was created           |
| UsageCount     | Number             | Times used                        |
| LastUsed       | Date/Time          | Last usage date                   |
| CreatedBy      | Person             | Who approved                      |

---

## 6. Azure OpenAI Integration

### 6.1 Service Configuration

```typescript
// AzureOpenAIService.ts
interface IAzureOpenAIConfig {
	endpoint: string; // e.g., https://your-resource.openai.azure.com/
	apiKey: string; // Stored securely (Azure Key Vault recommended)
	deploymentName: string; // e.g., "gpt-35-turbo" or "gpt-4"
	apiVersion: string; // e.g., "2024-02-15-preview"
}
```

### 6.2 Prompt Strategy

```typescript
const systemPrompt = `You are an expert in building components and lead paint inspection terminology.
Given a list of component names, group semantically similar names and return a canonical name for each group.

Consider:
- Spelling variations (wainscoting vs wainscot)
- Punctuation differences (door-jamb vs door jamb)
- Abbreviations (W/S = Window Sill)
- Synonyms in construction (baseboard = base molding)
- Case differences

Return JSON format:
{
  "normalizations": [
    {
      "canonical": "Door Jamb",
      "variants": ["door jamb", "door-jamb", "doorjamb"],
      "confidence": 0.95
    }
  ]
}`;
```

### 6.3 Caching Strategy

```
1. Extract unique component names from uploaded file
2. Query SharePoint cache for existing mappings
3. Filter to only UNKNOWN names
4. Send unknown names to Azure OpenAI (if any)
5. Present results for user review
6. Store approved mappings in cache
7. Apply all mappings to readings
```

### 6.4 Cost Optimization

| Model         | Cost (approx)     | Speed  | Accuracy |
| ------------- | ----------------- | ------ | -------- |
| GPT-4         | ~$0.03/1K tokens  | Slower | Highest  |
| GPT-3.5-turbo | ~$0.002/1K tokens | Fast   | Good     |

**Recommendation**: Start with GPT-3.5-turbo. With caching, costs approach zero over time.

---

## 7. Security Considerations

### 7.1 API Key Storage

- Store Azure OpenAI API key in Azure Key Vault
- Access via managed identity or secure SPFx property bag
- Never hardcode in source

### 7.2 SharePoint Permissions

- Web part requires read/write to document libraries
- Users need at least Contribute permissions
- Consider separate permission groups for admins vs. users

### 7.3 Data Privacy

- XRF data stays within SharePoint tenant
- Azure OpenAI in same tenant = data doesn't leave Azure
- Component names only (no PII) sent to AI

---

## 8. Development Setup

### 8.1 Prerequisites

```bash
# Node.js 18.x LTS
node --version

# Install SPFx toolchain
npm install -g yo @microsoft/generator-sharepoint gulp-cli

# Verify
yo --version
gulp --version
```

### 8.2 Project Creation

```bash
# Create new SPFx project
yo @microsoft/sharepoint

# Prompts:
# - Solution name: xrf-processor
# - Component type: WebPart
# - Framework: React
# - Web part name: XrfProcessor
```

### 8.3 Dependencies

```bash
npm install @pnp/sp @pnp/spfx-controls-react xlsx --save
npm install @types/node --save-dev
```

---

## 9. Deployment

### 9.1 Build & Package

```bash
# Build
gulp build

# Bundle for production
gulp bundle --ship

# Create .sppkg
gulp package-solution --ship
```

### 9.2 Deploy to SharePoint

1. Upload `.sppkg` to App Catalog
2. Deploy and trust the solution
3. Add web part to a SharePoint page
4. Configure web part properties (if any)

---

## 10. Infrastructure Testing Priority

**Early Phase 1 Goal**: Validate SPFx ↔ SharePoint connectivity

```typescript
// Minimal test: Can we read/write to SharePoint?
import { sp } from "@pnp/sp";

async function testConnection(): Promise<boolean> {
	try {
		// Test read
		const lists = await sp.web.lists.get();
		console.log("✅ Read successful:", lists.length, "lists found");

		// Test write to a test library
		const result = await sp.web.lists
			.getByTitle("XRF-SourceFiles")
			.items.add({ Title: "Connection Test" });
		console.log("✅ Write successful:", result.data.Id);

		return true;
	} catch (error) {
		console.error("❌ Connection failed:", error);
		return false;
	}
}
```

---

## 11. Revision History

| Date       | Version | Changes                                  |
| ---------- | ------- | ---------------------------------------- |
| 2026-01-07 | 1.0     | Initial architecture                     |
| 2026-01-07 | 1.1     | Split from requirements, technical focus |
