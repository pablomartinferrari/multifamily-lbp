# XRF Lead Paint Inspection Processor - Implementation Plan

> **Related Documents:**
>
> - [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture, technology stack
> - [REQUIREMENTS.md](./REQUIREMENTS.md) - Business logic, data models, summary rules
> - [plan/](./plan/) - **Individual building block files**

---

## Quick Links to Building Blocks

| #   | Building Block                   | File                                                                  |
| --- | -------------------------------- | --------------------------------------------------------------------- |
| 01  | SPFx Setup & Infrastructure Test | [BB-01-spfx-setup.md](./plan/BB-01-spfx-setup.md)                     |
| 02  | SharePoint Libraries Setup       | [BB-02-sharepoint-libraries.md](./plan/BB-02-sharepoint-libraries.md) |
| 03  | SharePoint Service (PnP JS)      | [BB-03-sharepoint-service.md](./plan/BB-03-sharepoint-service.md)     |
| 04  | Excel Parser Service             | [BB-04-excel-parser.md](./plan/BB-04-excel-parser.md)                 |
| 05  | Summary Service                  | [BB-05-summary-service.md](./plan/BB-05-summary-service.md)           |
| 06  | Azure OpenAI Integration         | [BB-06-azure-openai.md](./plan/BB-06-azure-openai.md)                 |
| 07  | File Upload Component            | [BB-07-file-upload-ui.md](./plan/BB-07-file-upload-ui.md)             |
| 08  | AI Review Component              | [BB-08-ai-review-ui.md](./plan/BB-08-ai-review-ui.md)                 |
| 09  | Results Summary Component        | [BB-09-results-ui.md](./plan/BB-09-results-ui.md)                     |
| 10  | End-to-End Flow                  | [BB-10-e2e-flow.md](./plan/BB-10-e2e-flow.md)                         |
| 11  | Deployment                       | [BB-11-deployment.md](./plan/BB-11-deployment.md)                     |

---

## 1. Building Blocks Overview

The implementation is divided into independent building blocks that can be developed and tested incrementally.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            BUILDING BLOCKS                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  FOUNDATION                           CORE SERVICES                             │
│  ────────────                         ─────────────                             │
│  ┌─────────────────────┐              ┌─────────────────────┐                  │
│  │ BB-01: SPFx Setup   │              │ BB-04: Excel Parser │                  │
│  │ & Infrastructure    │              │ Service             │                  │
│  └─────────────────────┘              └─────────────────────┘                  │
│           │                                    │                                │
│           ▼                                    ▼                                │
│  ┌─────────────────────┐              ┌─────────────────────┐                  │
│  │ BB-02: SharePoint   │              │ BB-05: Summary      │                  │
│  │ Libraries Setup     │              │ Service             │                  │
│  └─────────────────────┘              └─────────────────────┘                  │
│           │                                    │                                │
│           ▼                                    ▼                                │
│  ┌─────────────────────┐              ┌─────────────────────┐                  │
│  │ BB-03: SharePoint   │              │ BB-06: Azure OpenAI │                  │
│  │ Service (PnP JS)    │              │ Integration         │                  │
│  └─────────────────────┘              └─────────────────────┘                  │
│                                                                                 │
│  UI COMPONENTS                        INTEGRATION                               │
│  ─────────────                        ───────────                               │
│  ┌─────────────────────┐              ┌─────────────────────┐                  │
│  │ BB-07: File Upload  │              │ BB-10: End-to-End   │                  │
│  │ Component           │              │ Processing Flow     │                  │
│  └─────────────────────┘              └─────────────────────┘                  │
│           │                                    │                                │
│           ▼                                    ▼                                │
│  ┌─────────────────────┐              ┌─────────────────────┐                  │
│  │ BB-08: AI Review    │              │ BB-11: Deployment   │                  │
│  │ Component           │              │ & Configuration     │                  │
│  └─────────────────────┘              └─────────────────────┘                  │
│           │                                                                     │
│           ▼                                                                     │
│  ┌─────────────────────┐                                                       │
│  │ BB-09: Results      │                                                       │
│  │ Summary Component   │                                                       │
│  └─────────────────────┘                                                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Dependency Graph

```
BB-01 (SPFx Setup)
  │
  ├──▶ BB-02 (SharePoint Libraries)
  │      │
  │      └──▶ BB-03 (SharePoint Service) ──┐
  │                                         │
  ├──▶ BB-04 (Excel Parser) ───────────────┼──▶ BB-10 (E2E Flow)
  │      │                                  │         │
  │      └──▶ BB-05 (Summary Service) ─────┤         │
  │                                         │         ▼
  └──▶ BB-06 (Azure OpenAI) ───────────────┘    BB-11 (Deploy)
         │
         ▼
  BB-07 (File Upload UI)
         │
         ├──▶ BB-08 (AI Review UI)
         │
         └──▶ BB-09 (Results UI)
```

---

## 3. Building Block Details

### BB-01: SPFx Project Setup & Infrastructure Test

**Priority**: 🔴 Critical (Start Here)  
**Estimated Effort**: 2-4 hours  
**Dependencies**: None

#### Objectives

- [ ] Create SPFx project with Yeoman
- [ ] Configure development environment
- [ ] **Validate SharePoint connectivity early**
- [ ] Set up project structure

#### Tasks

```
□ Install Node.js 18.x LTS
□ Install SPFx toolchain (yo, gulp-cli, @microsoft/generator-sharepoint)
□ Run: yo @microsoft/sharepoint
    - Solution: xrf-processor
    - Component: WebPart
    - Framework: React
    - Name: XrfProcessor
□ Install dependencies: @pnp/sp, @pnp/spfx-controls-react, xlsx
□ Configure PnP JS in web part
□ Create minimal "connection test" that reads/writes to SharePoint
□ Verify local workbench connects to SharePoint
```

#### Acceptance Criteria

- [ ] `gulp serve` launches local workbench
- [ ] Web part renders in SharePoint workbench
- [ ] Can read list items from SharePoint
- [ ] Can write list items to SharePoint

#### Output

- Working SPFx project
- Verified SharePoint connectivity

---

### BB-02: SharePoint Libraries Setup

**Priority**: 🔴 Critical  
**Estimated Effort**: 1-2 hours  
**Dependencies**: BB-01

#### Objectives

- [ ] Create required SharePoint libraries
- [ ] Configure columns and metadata
- [ ] Create component cache list

#### Tasks

```
□ Create document library: XRF-SourceFiles
    □ Add column: JobNumber (Text)
    □ Add column: AreaType (Choice: Units, Common Areas)
    □ Add column: ProcessedStatus (Choice: Pending, Complete, Error)
    □ Add column: ProcessedResultsLink (Hyperlink)

□ Create document library: XRF-ProcessedResults
    □ Add column: JobNumber (Text, indexed)
    □ Add column: AreaType (Choice)
    □ Add column: SourceFileLink (Hyperlink)
    □ Add column: TotalReadings (Number)
    □ Add column: UniqueComponents (Number)
    □ Add column: LeadPositiveCount (Number)
    □ Add column: LeadPositivePercent (Number)

□ Create list: XRF-ComponentCache
    □ Add column: NormalizedName (Text)
    □ Add column: Confidence (Number)
    □ Add column: Source (Choice: AI, Manual)
    □ Add column: UsageCount (Number)
    □ Add column: LastUsed (DateTime)
```

#### Acceptance Criteria

- [ ] All three SharePoint artifacts exist
- [ ] Columns configured correctly
- [ ] Can manually add items to test

#### Output

- SharePoint libraries ready for use

---

### BB-03: SharePoint Service (PnP JS)

**Priority**: 🔴 Critical  
**Estimated Effort**: 3-4 hours  
**Dependencies**: BB-01, BB-02

#### Objectives

- [ ] Create SharePointService.ts
- [ ] Implement CRUD operations for all libraries
- [ ] Handle file uploads with metadata

#### Tasks

```
□ Create src/services/SharePointService.ts
□ Implement: uploadSourceFile(file, metadata) → uploads to XRF-SourceFiles
□ Implement: saveProcessedResults(summary) → saves to XRF-ProcessedResults
□ Implement: getComponentCache() → reads all cached mappings
□ Implement: updateComponentCache(mappings) → adds/updates cache entries
□ Implement: linkSourceToResults(sourceId, resultsId) → cross-links items
□ Add error handling and logging
□ Write unit tests for each method
```

#### Acceptance Criteria

- [ ] Can upload file with metadata
- [ ] Can save JSON summary to library
- [ ] Can read/write component cache
- [ ] Error handling works

#### Output

- `SharePointService.ts` with full CRUD operations

---

### BB-04: Excel Parser Service

**Priority**: 🟡 High  
**Estimated Effort**: 3-4 hours  
**Dependencies**: BB-01

#### Objectives

- [ ] Parse XRF Excel files with SheetJS
- [ ] Map Excel rows to IXrfReading[]
- [ ] Handle data validation

#### Tasks

```
□ Create src/services/ExcelParserService.ts
□ Create src/models/IXrfReading.ts with all fields (including color)
□ Implement: parseFile(fileBuffer) → IXrfReading[]
□ Handle column mapping (may need configuration)
□ Validate required fields present
□ Calculate isPositive from leadContent
□ Handle parsing errors gracefully
□ Write unit tests with mock Excel data
```

#### Acceptance Criteria

- [ ] Can parse .xlsx file to IXrfReading[]
- [ ] Color field extracted correctly
- [ ] isPositive calculated correctly
- [ ] Errors reported clearly

#### Output

- `ExcelParserService.ts`
- `IXrfReading.ts` model

---

### BB-05: Summary Service

**Priority**: 🟡 High  
**Estimated Effort**: 4-6 hours  
**Dependencies**: BB-04

#### Objectives

- [ ] Implement summary classification logic
- [ ] Generate Average, Uniform, Non-Uniform summaries
- [ ] Follow HUD/EPA methodology

#### Tasks

```
□ Create src/services/SummaryService.ts
□ Create src/models/IJobSummary.ts and related interfaces
□ Create src/constants/LeadThresholds.ts
□ Implement: classifyComponents(readings) → IDatasetSummary
□ Implement groupBy normalized component
□ Apply classification rules:
    □ ≥40 readings → Average (positive if >2.5%)
    □ <40 all same → Uniform
    □ <40 mixed → Non-Uniform
□ Implement: generateJobSummary(jobData) → IJobSummary
□ Write comprehensive unit tests for all classification scenarios
```

#### Acceptance Criteria

- [ ] Correct classification for ≥40 readings
- [ ] Correct classification for <40 uniform
- [ ] Correct classification for <40 non-uniform
- [ ] Edge cases handled (0 readings, exactly 40, etc.)

#### Output

- `SummaryService.ts`
- Full test coverage of business rules

---

### BB-06: Azure OpenAI Integration

**Priority**: 🟡 High  
**Estimated Effort**: 4-6 hours  
**Dependencies**: BB-01, BB-03

#### Objectives

- [ ] Connect to Azure OpenAI
- [ ] Implement component normalization
- [ ] Cache results in SharePoint

#### Tasks

```
□ Create src/services/AzureOpenAIService.ts
□ Create src/services/ComponentNormalizerService.ts
□ Create src/models/INormalizationResult.ts
□ Implement: normalizeComponents(componentNames) → INormalizationResult[]
□ Implement caching flow:
    □ Check cache first
    □ Only send unknown names to AI
    □ Store new mappings in cache
□ Configure API key storage (property bag or environment)
□ Handle rate limits and errors
□ Write tests with mocked AI responses
```

#### Acceptance Criteria

- [ ] Can call Azure OpenAI API
- [ ] Returns normalized component names
- [ ] Caching reduces API calls
- [ ] Errors handled gracefully

#### Output

- `AzureOpenAIService.ts`
- `ComponentNormalizerService.ts`
- Working AI normalization

---

### BB-07: File Upload Component

**Priority**: 🟢 Medium  
**Estimated Effort**: 3-4 hours  
**Dependencies**: BB-01

#### Objectives

- [ ] Create file upload UI
- [ ] Capture job metadata
- [ ] Trigger processing flow

#### Tasks

```
□ Create src/webparts/xrfProcessor/components/FileUpload/
□ Implement drag-and-drop file upload (Fluent UI or PnP control)
□ Implement Job Number input field
□ Implement Area Type selector (Units / Common Areas)
□ Add file type validation (.xlsx only)
□ Add "Process" button
□ Show upload progress
□ Style with Fluent UI
```

#### Acceptance Criteria

- [ ] Can select/drop .xlsx file
- [ ] Job Number required before processing
- [ ] Area Type selection works
- [ ] Invalid files rejected

#### Output

- `FileUpload.tsx` component

---

### BB-08: AI Normalization Review Component

**Priority**: 🟢 Medium  
**Estimated Effort**: 4-5 hours  
**Dependencies**: BB-06, BB-07

#### Objectives

- [ ] Display AI suggestions to user
- [ ] Allow accept/reject/edit
- [ ] Confirm before applying

#### Tasks

```
□ Create src/webparts/xrfProcessor/components/AINormalizationReview/
□ Implement modal/panel for review
□ Display each normalization group:
    □ Original names
    □ Suggested canonical name
    □ Confidence score
□ Implement Accept/Reject/Edit actions per group
□ Implement "Accept All High Confidence" bulk action
□ Implement confirmation before applying
□ Style with Fluent UI
```

#### Acceptance Criteria

- [ ] Shows AI suggestions clearly
- [ ] Can accept/reject individual suggestions
- [ ] Can edit canonical names
- [ ] Bulk accept works

#### Output

- `AINormalizationReview.tsx` component

---

### BB-09: Results Summary Component

**Priority**: 🟢 Medium  
**Estimated Effort**: 3-4 hours  
**Dependencies**: BB-05

#### Objectives

- [ ] Display summary tables
- [ ] Show all three summary types
- [ ] Separate Common Areas and Units

#### Tasks

```
□ Create src/webparts/xrfProcessor/components/ResultsSummary/
□ Implement tabbed view (Common Areas | Units)
□ Implement Average Components table
□ Implement Uniform Components table
□ Implement Non-Uniform Components table (with expandable details)
□ Add visual indicators (positive = red, negative = green)
□ Style with Fluent UI DetailsList or custom tables
```

#### Acceptance Criteria

- [ ] All three summary types displayed
- [ ] Can switch between Common Areas and Units
- [ ] Visual clarity on positive/negative
- [ ] Non-uniform shows detail view

#### Output

- `ResultsSummary.tsx` component

---

### BB-10: End-to-End Processing Flow

**Priority**: 🟢 Medium  
**Estimated Effort**: 4-6 hours  
**Dependencies**: BB-03 through BB-09

#### Objectives

- [ ] Wire all components together
- [ ] Implement full processing pipeline
- [ ] Handle state management

#### Tasks

```
□ Update XrfProcessor.tsx as main orchestrator
□ Implement processing state machine:
    □ IDLE → UPLOADING → PARSING → NORMALIZING → REVIEWING → SUMMARIZING → STORING → COMPLETE
□ Wire FileUpload → ExcelParser → Normalizer → Summary → SharePoint
□ Handle errors at each stage
□ Show progress/status throughout
□ Test full flow end-to-end
```

#### Acceptance Criteria

- [ ] Complete flow works: upload → process → display
- [ ] Errors handled at each stage
- [ ] User can see progress
- [ ] Results saved to SharePoint

#### Output

- Fully integrated solution

---

### BB-11: Deployment & Configuration

**Priority**: 🔵 Final  
**Estimated Effort**: 2-3 hours  
**Dependencies**: BB-10

#### Objectives

- [ ] Package for production
- [ ] Deploy to SharePoint
- [ ] Configure for production

#### Tasks

```
□ Configure production Azure OpenAI settings
□ Set up secure API key storage
□ Run: gulp bundle --ship
□ Run: gulp package-solution --ship
□ Upload .sppkg to App Catalog
□ Deploy and trust solution
□ Create SharePoint page with web part
□ Test in production
□ Document deployment process
```

#### Acceptance Criteria

- [ ] Solution deployed to App Catalog
- [ ] Works on SharePoint page
- [ ] API keys secure
- [ ] Documentation complete

#### Output

- Production deployment

---

## 4. Suggested Development Order

```
Week 1: Foundation
├── Day 1-2: BB-01 (SPFx Setup + Infrastructure Test) ⭐ START HERE
├── Day 2-3: BB-02 (SharePoint Libraries)
└── Day 3-4: BB-03 (SharePoint Service)

Week 2: Core Services
├── Day 1-2: BB-04 (Excel Parser)
├── Day 2-3: BB-05 (Summary Service)
└── Day 3-4: BB-06 (Azure OpenAI)

Week 3: UI & Integration
├── Day 1-2: BB-07 (File Upload UI)
├── Day 2-3: BB-08 (AI Review UI)
├── Day 3: BB-09 (Results UI)
└── Day 4: BB-10 (E2E Integration)

Week 4: Polish & Deploy
├── Day 1-2: Testing & bug fixes
├── Day 3: BB-11 (Deployment)
└── Day 4: Documentation
```

---

## 5. Status Tracking

| Building Block              | Status         | Notes             |
| --------------------------- | -------------- | ----------------- |
| BB-01: SPFx Setup           | ⬜ Not Started |                   |
| BB-02: SharePoint Libraries | ⬜ Not Started |                   |
| BB-03: SharePoint Service   | ⬜ Not Started |                   |
| BB-04: Excel Parser         | ⬜ Not Started | Needs sample file |
| BB-05: Summary Service      | ⬜ Not Started |                   |
| BB-06: Azure OpenAI         | ⬜ Not Started |                   |
| BB-07: File Upload UI       | ⬜ Not Started |                   |
| BB-08: AI Review UI         | ⬜ Not Started |                   |
| BB-09: Results UI           | ⬜ Not Started |                   |
| BB-10: E2E Flow             | ⬜ Not Started |                   |
| BB-11: Deployment           | ⬜ Not Started |                   |

---

## 6. Revision History

| Date       | Version | Changes                     |
| ---------- | ------- | --------------------------- |
| 2026-01-07 | 1.0     | Initial implementation plan |
