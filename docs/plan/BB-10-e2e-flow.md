# BB-10: End-to-End Processing Flow

> **Priority**: 🟢 Medium  
> **Estimated Effort**: 4-6 hours  
> **Dependencies**: BB-03 through BB-09  
> **Status**: ✅ Complete

---

## Objective

Wire all components and services together into a complete processing pipeline with state management and error handling.

---

## Prerequisites

- All previous building blocks completed (BB-01 through BB-09)

---

## Tasks

### 1. Create Processing State Types

Create `src/models/IProcessingState.ts`:

```typescript
export type ProcessingStep = 
  | "IDLE"
  | "UPLOADING"
  | "PARSING"
  | "NORMALIZING"
  | "REVIEWING"
  | "SUMMARIZING"
  | "STORING"
  | "COMPLETE"
  | "ERROR";

export interface IProcessingState {
  step: ProcessingStep;
  progress: number;  // 0-100
  message: string;
  error?: string;
}
```

### 2. Create Main Orchestrator Component

Update `src/webparts/xrfProcessor/components/XrfProcessor.tsx`:

```typescript
import * as React from "react";
import { Stack, MessageBar, MessageBarType, ProgressIndicator } from "@fluentui/react";
import { SPFI } from "@pnp/sp";

import { FileUpload } from "./FileUpload/FileUpload";
import { AINormalizationReview } from "./AINormalizationReview/AINormalizationReview";
import { ResultsSummary } from "./ResultsSummary/ResultsSummary";

import { SharePointService } from "../../../services/SharePointService";
import { ExcelParserService } from "../../../services/ExcelParserService";
import { SummaryService } from "../../../services/SummaryService";
import { ComponentNormalizerService } from "../../../services/ComponentNormalizerService";
import { AzureOpenAIService } from "../../../services/AzureOpenAIService";

import { IXrfReading } from "../../../models/IXrfReading";
import { IJobSummary } from "../../../models/ISummary";
import { IComponentNormalization } from "../../../models/INormalization";
import { IProcessingState, ProcessingStep } from "../../../models/IProcessingState";

export interface IXrfProcessorProps {
  sp: SPFI;
  openAIConfig: { endpoint: string; apiKey: string; deploymentName: string; apiVersion: string };
}

export const XrfProcessor: React.FC<IXrfProcessorProps> = ({ sp, openAIConfig }) => {
  // Services
  const spService = React.useMemo(() => new SharePointService(sp), [sp]);
  const parserService = React.useMemo(() => new ExcelParserService(), []);
  const summaryService = React.useMemo(() => new SummaryService(), []);
  const openAIService = React.useMemo(() => new AzureOpenAIService(openAIConfig), [openAIConfig]);
  const normalizerService = React.useMemo(
    () => new ComponentNormalizerService(openAIService, spService),
    [openAIService, spService]
  );

  // State
  const [state, setState] = React.useState<IProcessingState>({
    step: "IDLE",
    progress: 0,
    message: "",
  });
  const [readings, setReadings] = React.useState<IXrfReading[]>([]);
  const [normalizations, setNormalizations] = React.useState<IComponentNormalization[]>([]);
  const [summary, setSummary] = React.useState<IJobSummary | null>(null);
  const [jobMetadata, setJobMetadata] = React.useState<{
    file: File;
    jobNumber: string;
    areaType: "Units" | "Common Areas";
  } | null>(null);

  const updateState = (step: ProcessingStep, progress: number, message: string, error?: string) => {
    setState({ step, progress, message, error });
  };

  // Step 1: Handle file upload
  const handleFileSubmit = async (file: File, jobNumber: string, areaType: "Units" | "Common Areas") => {
    setJobMetadata({ file, jobNumber, areaType });
    
    try {
      // Parse Excel
      updateState("PARSING", 20, "Parsing Excel file...");
      const buffer = await file.arrayBuffer();
      const parseResult = await parserService.parseFile(buffer);

      if (!parseResult.success) {
        throw new Error(parseResult.errors.map(e => e.message).join(", "));
      }

      setReadings(parseResult.readings);

      // Normalize components
      updateState("NORMALIZING", 40, "Normalizing component names...");
      const componentNames = [...new Set(parseResult.readings.map(r => r.component))];
      const norms = await normalizerService.normalizeComponents(componentNames);
      setNormalizations(norms);

      // Show review panel
      updateState("REVIEWING", 60, "Review AI suggestions...");
    } catch (error) {
      updateState("ERROR", 0, "", error instanceof Error ? error.message : String(error));
    }
  };

  // Step 2: Handle normalization approval
  const handleNormalizationApprove = async (approved: IComponentNormalization[]) => {
    try {
      updateState("SUMMARIZING", 70, "Generating summary...");

      // Apply normalizations to readings
      const normalizedReadings = readings.map(r => ({
        ...r,
        normalizedComponent: approved.find(n => n.originalName === r.component.toLowerCase())?.normalizedName || r.component,
      }));

      // Generate summary
      const jobSummary = summaryService.generateJobSummary(
        jobMetadata!.jobNumber,
        jobMetadata!.file.name,
        jobMetadata!.areaType === "Common Areas" ? normalizedReadings : null,
        jobMetadata!.areaType === "Units" ? normalizedReadings : null,
        approved.filter(n => n.source === "AI").length
      );

      // Store in SharePoint
      updateState("STORING", 85, "Saving to SharePoint...");
      
      const uploadResult = await spService.uploadSourceFile(jobMetadata!.file, {
        jobNumber: jobMetadata!.jobNumber,
        areaType: jobMetadata!.areaType,
      });

      const summaryJson = summaryService.toJson(jobSummary);
      await spService.saveProcessedResults(
        summaryJson,
        `${jobMetadata!.jobNumber}-${jobMetadata!.areaType}-summary.json`,
        {
          jobNumber: jobMetadata!.jobNumber,
          areaType: jobMetadata!.areaType,
          sourceFileUrl: uploadResult.fileUrl,
          totalReadings: normalizedReadings.length,
          uniqueComponents: new Set(normalizedReadings.map(r => r.normalizedComponent)).size,
          leadPositiveCount: normalizedReadings.filter(r => r.isPositive).length,
          leadPositivePercent: (normalizedReadings.filter(r => r.isPositive).length / normalizedReadings.length) * 100,
        }
      );

      // Save normalizations to cache
      await normalizerService.saveNormalizationsToCache(approved);

      setSummary(jobSummary);
      updateState("COMPLETE", 100, "Processing complete!");
    } catch (error) {
      updateState("ERROR", 0, "", error instanceof Error ? error.message : String(error));
    }
  };

  const handleReset = () => {
    setState({ step: "IDLE", progress: 0, message: "" });
    setReadings([]);
    setNormalizations([]);
    setSummary(null);
    setJobMetadata(null);
  };

  return (
    <Stack tokens={{ childrenGap: 16 }}>
      {/* Error Display */}
      {state.error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={handleReset}>
          {state.error}
        </MessageBar>
      )}

      {/* Progress */}
      {state.step !== "IDLE" && state.step !== "COMPLETE" && state.step !== "ERROR" && (
        <ProgressIndicator label={state.message} percentComplete={state.progress / 100} />
      )}

      {/* File Upload (IDLE state) */}
      {state.step === "IDLE" && (
        <FileUpload onSubmit={handleFileSubmit} isProcessing={false} />
      )}

      {/* AI Review Panel */}
      <AINormalizationReview
        isOpen={state.step === "REVIEWING"}
        normalizations={normalizations}
        onApprove={handleNormalizationApprove}
        onCancel={handleReset}
      />

      {/* Results Display */}
      {state.step === "COMPLETE" && summary && (
        <ResultsSummary summary={summary} />
      )}
    </Stack>
  );
};
```

---

## Acceptance Criteria

- [ ] Complete flow works: upload → parse → normalize → review → summarize → store
- [ ] Progress indicator shows current step
- [ ] Errors displayed and allow retry
- [ ] Results saved to SharePoint
- [ ] Can process another file after completion

---

## Output Artifacts

```
src/
├── models/
│   └── IProcessingState.ts
└── webparts/xrfProcessor/components/
    └── XrfProcessor.tsx (updated)
```

---

## Next Steps

➡️ Proceed to **BB-11: Deployment & Configuration**



