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
- **SharePoint Integration**: Stores data in SharePoint lists for record-keeping
- **Component & Substrate Grouping**: Aggregates readings by component + substrate combinations

## Workflow

### Step 1: Upload File
1. Enter the **Job Number** (project identifier)
2. Select **Area Type**: "Units" (apartments) or "Common Areas" (hallways, lobbies, etc.)
3. Either upload a new Excel/CSV file OR click "Load Existing Data" if data was previously uploaded

### Step 2: Data Processing
- The system parses the uploaded file
- AI normalizes component names (e.g., "dr jamb" → "Door Jamb")
- AI normalizes substrate names (e.g., "wd" → "Wood")
- Normalizations are cached for faster future processing

### Step 3: Review Data
- Review all readings in a grid view
- Edit individual readings if needed
- Use "Bulk Edit" to change multiple readings at once
- Export to Excel for further analysis

### Step 4: Generate Summary
- Click "Generate Summary" to create HUD/EPA compliant reports
- View summaries organized by component/substrate combinations
- Export summaries to Excel

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
- **Merge (default)**: Combines new readings with existing data; duplicates are updated
- **Replace**: Removes all previous readings and uses only the new file

### Load Existing Data
If you've already uploaded data for a job/area:
- Enter the Job Number and Area Type
- Click "Load Existing Data" to retrieve and re-process without uploading

## Data Review Grid Features

### Inline Editing
- Click on any cell to edit individual readings
- Changes are applied immediately

### Bulk Edit
- Select multiple readings using checkboxes
- Use "Bulk Edit" button to change component or substrate for all selected

### Export Options
- Export to Excel: Full data with all columns
- Export includes both original and normalized values

## All Shots Report
- Shows every individual reading
- Searchable and filterable
- Export to Excel or CSV
- Includes: Reading ID, Location, Room, Component, Substrate, Lead Content, Result

## Tips for Best Results

### File Format
- Use Excel (.xlsx) or CSV files
- Required columns: Component, Lead Content (or PbC, Lead)
- Optional columns: Substrate, Location, Room, Reading ID, Color

### Component Names
- Be consistent with naming when possible
- AI will normalize variations, but consistent input improves accuracy

### Substrate Information
- Include substrate (surface material) when available
- Helps with more accurate grouping and analysis

## Troubleshooting

### "No readings found"
- Check that your file has the required columns
- Ensure data is in the first sheet (for Excel files)

### "AI normalization failed"
- Check your OpenAI/Azure OpenAI configuration
- Verify API key is valid and has available credits

### Slow processing
- Large files may take longer
- AI normalization is batched for efficiency
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
