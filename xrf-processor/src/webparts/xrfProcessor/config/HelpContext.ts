/**
 * Help context document for the AI-powered help assistant.
 * This documentation is sent to OpenAI along with user questions.
 */
export const HELP_CONTEXT = `
# XRF Lead Paint Processor - User Guide

## Overview
The XRF Lead Paint Processor is a SharePoint web part that processes XRF (X-Ray Fluorescence) lead paint inspection data. It helps property managers and inspectors analyze lead paint inspection readings according to HUD/EPA guidelines.

## Key Features
- **Excel & CSV File Upload**: Upload XRF inspection data in .xlsx or .csv format
- **AI-Powered Normalization**: Automatically standardizes component and substrate names using AI
- **HUD/EPA Compliant Summaries**: Generates inspection summaries following regulatory guidelines
- **Lead Inspector AI Hazards**: AI generates hazard descriptions and remediation options for positive components
- **SharePoint Integration**: Stores data in SharePoint lists for record-keeping
- **Component & Substrate Grouping**: Aggregates readings by component + substrate combinations

## Workflow

Upload and report generation are separate steps. You can upload Units and Common Areas files independently, then generate the report when ready.

### Step 1: Job Dashboard (Upload Data)
1. Enter the **Job Number** (project identifier). The app looks up this job in the ETC Files SharePoint library (Shared Documents) to validate it.
2. Upload files for **Units** and/or **Common Areas** separately:
   - Select Area Type: "Units" or "Common Areas"
   - Select or drag an Excel/CSV file
   - Click **Upload** to save the file to SharePoint
3. You can upload both Units and Common Areas for the same job, or just one.
4. The dashboard shows which data exists: "Units uploaded" and/or "Common Areas uploaded".
5. If you upload for a job/area that already has data, you'll see a conflict dialog to **Replace** or **Merge**.

### Step 2: Generate Report
1. Enter the Job Number (or keep it from the upload step).
2. Click **Generate Report**. The system loads all uploaded data for that job.
3. If both Units and Common Areas exist, both are processed together.
4. You can generate a report without uploading—use this to regenerate from existing data.
5. Processing steps: Parse files → AI normalize components → AI normalize substrates → Lead Inspector AI generates hazards → Save to SharePoint.

### Step 3: Review Data
- Review all readings in a grid view
- Review AI normalization suggestions
- Edit individual readings if needed
- Use "Bulk Edit" to change multiple readings at once
- Approve normalizations to proceed

### Step 4: Summary & Export
- Click **Generate Summary** to create the HUD/EPA compliant report
- The report always shows both **Common Areas** and **Units** tabs; if data is missing for one, that tab shows an empty state
- **Hazards** tab lists each positive component with AI-generated hazard description, severity, priority, abatement options, and interim control options
- Export to Excel (includes Hazards sheet when applicable)

## Report Structure
- **Common Areas tab**: Summary for hallway, lobby, shared-space data
- **Units tab**: Summary for individual apartment/unit data
- **All Shots tab**: Every individual reading, searchable
- **Hazards tab**: Lead Inspector AI hazard assessments with remediation options (abatement and interim control)

## Summary Categories (HUD/EPA Guidelines)

### Average Components (≥40 readings)
- Components with 40 or more readings use statistical averaging
- **Threshold**: If >2.5% of readings are positive → component marked POSITIVE
- If ≤2.5% positive → component marked NEGATIVE

### Uniform Components (<40 readings, all same result)
- Components with fewer than 40 readings where ALL readings have the same result
- All positive → POSITIVE
- All negative → NEGATIVE

### Non-Uniform Components (<40 readings, mixed results)
- Components with fewer than 40 readings with MIXED results
- Requires individual location-specific review
- Lists each reading location for detailed inspection

## Lead Content Threshold
- **Positive**: Lead content ≥ 1.0 mg/cm²
- **Negative**: Lead content < 1.0 mg/cm²

## Lead Inspector AI (Hazards)
When OpenAI/Azure OpenAI is configured, the report includes a **Hazards** section:
- Each positive component gets an AI-generated hazard description
- Severity (Critical, High, Moderate) and Priority (Restrict Access, ASAP, Schedule)
- Abatement options and Interim Control options from the standard HUD/EPA reference
- Export to Excel includes a Hazards sheet

## Component + Substrate Grouping
Readings are grouped by the combination of component AND substrate. For example:
- "Door Frame (Wood)" and "Door Frame (Metal)" are tracked separately
- This provides more precise lead paint location identification
- Summaries show Component and Substrate as separate columns

## AI Normalization
The system uses AI to standardize names:

### Component Normalization Examples:
- "dr jamb" / "door jamb" / "Door Jamb" → "Door Jamb"
- "clos. wall" / "closet wall" → "Closet Wall"
- "win sill" / "window sill" → "Window Sill"

### Substrate Normalization Examples:
- "wd" / "wood" / "Wood" → "Wood"
- "mtl" / "metal" → "Metal"
- "drywall" / "sheetrock" / "gypsum" → "Drywall"

### Cache System
- Normalizations are cached in SharePoint lists
- Previously normalized names are reused instantly
- Only new names require AI processing
- Cache improves speed and reduces API costs

## File Upload Options

### Replace vs Merge
When uploading a file for a job/area that already has data:
- A conflict dialog appears
- **Replace**: Removes existing data and uses only the new file
- **Merge**: Combines new readings with existing data; duplicates are updated

## File Format & Parsing
- Supports Excel (.xlsx) and CSV (.csv)
- Required columns: Component, Lead Content (or PbC, Lead, Concentration, Result)
- Optional columns: Substrate, Location, Room, Reading ID, Color
- The parser automatically detects the header row even when the file has metadata rows at the top (e.g., Pb200i/Viken devices)
- Supported column aliases: "Room Num", "Concentration", "mg/cm²", etc.

## Data Review Grid Features

### Inline Editing
- Click on any cell to edit individual readings
- Changes are applied immediately

### Bulk Edit
- Select multiple readings using checkboxes
- Use "Bulk Edit" button to change component or substrate for all selected

### Export Options
- Export to Excel: Full data with all columns, plus Hazards sheet when applicable
- Export includes both original and normalized values

## All Shots Report
- Shows every individual reading
- Searchable and filterable
- Export to Excel or CSV
- Includes: Reading ID, Location, Room, Component, Substrate, Lead Content, Result

## Tips for Best Results

### File Format
- Use Excel (.xlsx) or CSV (.csv) files
- Required columns: Component, Lead Content (or PbC, Lead, Concentration)
- Optional columns: Substrate, Location, Room, Reading ID, Color
- Files with metadata at the top (device info, etc.) are supported—header row is auto-detected

### Component Names
- Be consistent with naming when possible
- AI will normalize variations, but consistent input improves accuracy

### Substrate Information
- Include substrate (surface material) when available
- Helps with more accurate grouping and analysis

## Troubleshooting

### "No readings found"
- Check that your file has the required columns (Component, Lead Content)
- For Excel files with metadata rows, the parser scans up to 25 rows to find the header
- Ensure data exists in the first sheet

### "AI normalization failed" or no hazards
- Check your OpenAI/Azure OpenAI configuration in the web part settings
- Verify API key is valid and has available credits
- Hazards are only generated when AI is configured

### Job lookup shows error
- Job lookup searches the ETC Files document library; report generation works even if the job is not found there
- Ensure you have access to the ETC Files site and that the job number matches a folder name in Shared Documents

### Slow processing
- Large files may take longer
- AI normalization and hazards generation are batched for efficiency
- Cached normalizations speed up repeat processing

## SharePoint Lists Used
- **XRF-ComponentCache**: Cached component normalizations
- **XRF-SubstrateCache**: Cached substrate normalizations
- **XRF-SourceFiles**: Uploaded source files
- **XRF-Readings**: Processed reading data
- **XRF-ProcessingJobs**: Job metadata and status
`;

/**
 * System prompt for the help assistant
 */
export const HELP_SYSTEM_PROMPT = `You are a helpful assistant for the XRF Lead Paint Processor application.

Your role is to answer user questions about how to use the application, explain features, and help troubleshoot issues.

Use the following documentation to answer questions:

${HELP_CONTEXT}

Guidelines:
- Be concise but thorough
- Use bullet points for lists
- Reference specific features by name
- If the question is not covered in the documentation, say "I don't have specific information about that, but..." and provide general guidance
- For technical issues, suggest checking the relevant configuration or contacting support
- Be friendly and professional
`;
