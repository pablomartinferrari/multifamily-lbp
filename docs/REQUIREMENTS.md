# XRF Lead Paint Inspection Processor - Requirements Document

## 1. Product Overview

A SharePoint-based tool for processing XRF (X-ray Fluorescence) lead paint inspection data. Users upload Excel files from XRF devices, and the system generates standardized summaries following HUD/EPA statistical sampling methodology.

---

## 2. User Stories

### US-001: Upload XRF Data
**As an** inspector  
**I want to** upload an Excel file with XRF readings  
**So that** the data can be processed and summarized

**Acceptance Criteria:**
- User can drag-and-drop or browse to select .xlsx file
- User must enter a Job Number before processing
- User must select dataset type: "Units" or "Common Areas"
- System validates file format before processing

### US-002: AI Component Normalization
**As an** inspector  
**I want** the system to automatically detect similar component names  
**So that** summaries group related components correctly

**Acceptance Criteria:**
- System identifies semantically similar names (e.g., "door jamb" ≈ "door-jamb")
- User must review and approve AI suggestions before applying
- Approved normalizations are cached for future use
- User can edit or reject AI suggestions

### US-003: View Component Summaries
**As a** project manager  
**I want to** see lead paint results summarized by component  
**So that** I can quickly identify areas requiring remediation

**Acceptance Criteria:**
- Summaries follow the three-category classification (Average, Uniform, Non-Uniform)
- Separate summaries for Common Areas and Units
- Results stored in SharePoint library for future reference

---

## 3. Data Model

### 3.1 XRF Reading (Input)

```typescript
interface IXrfReading {
	// === CRITICAL FIELDS ===
	readingId: string;            // Unique reading identifier
	component: string;            // Raw component name from XRF device
	color: string;                // 🔴 CRITICAL: Paint color at reading location
	leadContent: number;          // Lead concentration (mg/cm²)
	
	// === NORMALIZED (added by system) ===
	normalizedComponent?: string; // AI-normalized component name
	isPositive: boolean;          // Calculated: leadContent >= 1.0
	
	// === LOCATION (flexible structure) ===
	location: string;             // Full location string from device
	// Future: may split into roomType + roomNumber
	// roomType?: string;         // e.g., "Bedroom", "Kitchen", "Hallway"
	// roomNumber?: string;       // e.g., "101", "2A"
	
	// === ADDITIONAL FIELDS ===
	substrate?: string;           // e.g., "Wood", "Metal", "Drywall"
	side?: string;                // e.g., "A", "B" (for doors)
	timestamp?: Date;             // When reading was taken
	
	// ... additional fields TBD based on actual XRF export
}
```

### 3.2 Job Structure

```typescript
interface IJobData {
	jobNumber: string;
	uploadDate: Date;
	commonAreaReadings: IXrfReading[];
	unitReadings: IXrfReading[];
}
```

### 3.3 Summary Output Models

```typescript
// For components with ≥40 readings (statistical sampling)
interface IAverageComponentSummary {
	component: string;
	totalReadings: number;
	positiveCount: number;
	negativeCount: number;
	positivePercent: number;
	negativePercent: number;
	result: "POSITIVE" | "NEGATIVE";
}

// For components with <40 readings, all same result
interface IUniformComponentSummary {
	component: string;
	totalReadings: number;
	result: "POSITIVE" | "NEGATIVE";
}

// For components with <40 readings, mixed results
interface INonUniformComponentSummary {
	component: string;
	totalReadings: number;
	positiveCount: number;
	negativeCount: number;
	readings: IXrfReading[];
}

// Complete summary for one dataset
interface IDatasetSummary {
	datasetType: "COMMON_AREA" | "UNITS";
	totalReadings: number;
	uniqueComponents: number;
	averageComponents: IAverageComponentSummary[];
	uniformComponents: IUniformComponentSummary[];
	nonUniformComponents: INonUniformComponentSummary[];
}

// Complete job summary
interface IJobSummary {
	jobNumber: string;
	processedDate: Date;
	sourceFileName: string;
	aiNormalizationsApplied: number;
	commonAreaSummary: IDatasetSummary;
	unitsSummary: IDatasetSummary;
}
```

---

## 4. Business Rules

### 4.1 Lead Content Classification

| Condition | Classification |
|-----------|----------------|
| `leadContent >= 1.0` mg/cm² | **POSITIVE** |
| `leadContent < 1.0` mg/cm² | **NEGATIVE** |

### 4.2 Component Summary Classification

Each component in a dataset is classified into exactly ONE summary type:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPONENT CLASSIFICATION LOGIC                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   For each unique (normalized) component in the dataset:                    │
│                                                                             │
│   readings_count = count of readings for this component                     │
│   positive_count = readings where lead_content >= 1.0                       │
│   positive_pct = positive_count / readings_count × 100                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   RULE 1: AVERAGE COMPONENTS (Statistical Sampling)                         │
│   ─────────────────────────────────────────────────                         │
│   IF readings_count >= 40:                                                  │
│      • Result = POSITIVE if positive_pct > 2.5%                             │
│      • Result = NEGATIVE if positive_pct <= 2.5%                            │
│      • Output: Component, Result, Positive%, Negative%, Total               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   RULE 2: UNIFORM COMPONENTS                                                │
│   ──────────────────────────                                                │
│   IF readings_count < 40 AND all readings same result:                      │
│      • Result = POSITIVE if all positive                                    │
│      • Result = NEGATIVE if all negative                                    │
│      • Output: Component, Result, Total                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   RULE 3: NON-UNIFORM COMPONENTS                                            │
│   ──────────────────────────────                                            │
│   IF readings_count < 40 AND mixed results:                                 │
│      • Output: Component, Total, Positive Count, Negative Count             │
│      • Include individual reading details for report                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Thresholds (Constants)

```typescript
const LEAD_POSITIVE_THRESHOLD = 1.0;      // mg/cm² - reading is positive if >= this
const STATISTICAL_SAMPLE_SIZE = 40;        // readings needed for average method
const POSITIVE_PERCENT_THRESHOLD = 2.5;    // % positive to classify component as positive
```

---

## 5. Summary Output Examples

### 5.1 Average Components Summary
*Components with ≥40 readings - uses statistical sampling*

| Component | Result | Positive % | Negative % | Total Readings |
|-----------|--------|------------|------------|----------------|
| Door Jamb | POSITIVE | 4.2% | 95.8% | 48 |
| Window Sill | NEGATIVE | 1.8% | 98.2% | 52 |
| Wall | NEGATIVE | 0.5% | 99.5% | 120 |

### 5.2 Uniform Component Summary
*Components with <40 readings, all same result*

| Component | Result | Total Readings |
|-----------|--------|----------------|
| Baseboard | NEGATIVE | 12 |
| Crown Molding | POSITIVE | 8 |
| Ceiling | NEGATIVE | 15 |

### 5.3 Non-Uniform Component Summary
*Components with <40 readings, mixed results - requires individual review*

| Component | Total Count | Positive Count | Negative Count |
|-----------|-------------|----------------|----------------|
| Wainscoting | 15 | 3 | 12 |
| Chair Rail | 22 | 7 | 15 |
| Radiator | 8 | 2 | 6 |

---

## 6. AI Component Normalization

### 6.1 Problem Statement

XRF inspection data has inconsistent component naming:
- Different inspectors use different terms: "door jamb" vs "door-jamb" vs "doorjamb"
- Spelling variations: "wainscoting" vs "wainscotting" vs "wainscot"
- Abbreviations: "W/S" vs "Window Sill" vs "window sill"
- Synonyms: "baseboard" vs "base molding" vs "floor trim"

### 6.2 Solution

Azure OpenAI analyzes component names and groups semantically similar terms:

```
Raw Input                    →    Normalized Output
─────────────────────────         ─────────────────
"door jamb"                 ─┐
"Door Jamb"                  │    "Door Jamb"
"door-jamb"                  ├─→  (canonical)
"doorjamb"                  ─┘

"wainscoting"               ─┐
"wainscot panel"             ├─→  "Wainscoting"
"WAINSCOT"                  ─┘

"Window Sill"               ─┐
"window stool"               ├─→  "Window Sill"
"W/S"                       ─┘
```

### 6.3 User Review Workflow

**REQUIREMENT**: User must review and approve AI suggestions before applying.

```
┌─────────────────────────────────────────────────────────────────────┐
│  🤖 AI Component Normalization Suggestions                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  The following components will be merged:                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✓  "door jamb", "door-jamb", "Door Jamb"                   │   │
│  │      → Normalized to: "Door Jamb"        [Accept] [Edit]    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⚠  "baseboard", "chair rail"   (Low confidence: 60%)       │   │
│  │      → Normalized to: "Baseboard"        [Accept] [Reject]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                              [Accept All High Confidence] [Review]  │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.4 Caching Behavior

- Approved normalizations are cached in SharePoint
- Future uploads check cache first (reduces AI API calls)
- System learns and improves over time
- No master component list - AI determines canonical names dynamically

---

## 7. Confirmed Decisions

| Decision | Status | Details |
|----------|--------|---------|
| Azure OpenAI Access | ✅ Confirmed | User has access |
| AI Review Required | ✅ Confirmed | User must approve suggestions |
| Master Component List | ✅ None | AI determines canonical names |
| Dataset Structure | ✅ Confirmed | Job → Common Areas + Units (separate summaries) |
| Lead Threshold | ⏳ Confirm | >= 1.0 mg/cm² = Positive? |

---

## 8. Open Questions

### Data Format
1. **🔴 Sample XRF Excel file needed** (anonymized if needed)
   - What columns does your XRF device export?
   - What device/software generates these files?

2. **Lead threshold confirmation**: Is 1.0 mg/cm² the correct positive threshold?

### Output Format
3. What happens after viewing summaries?
   - Download as PDF/Excel?
   - Just view in SharePoint?
   - Export to another system?

### Location Field
4. Should `location` be split into `roomType` + `roomNumber`?
   - Currently keeping flexible as single string
   - Can refine once sample data is available

---

## 9. Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-07 | 0.1 | Initial requirements extracted from architecture |
| 2026-01-07 | 0.2 | Added `color` as critical field, location flexibility note |



