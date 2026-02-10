import * as React from "react";
import styles from "./XrfProcessor.module.scss";
import type { IXrfProcessorProps } from "./IXrfProcessorProps";
import {
  PrimaryButton,
  DefaultButton,
  IconButton,
  MessageBar,
  MessageBarType,
  Stack,
  Text,
  ProgressIndicator,
  Icon,
  TooltipHost,
} from "@fluentui/react";
// Components
import { ConversationalJobFlow } from "./ConversationalJobFlow";
import { AINormalizationReview } from "./AINormalizationReview";
import { ResultsSummary } from "./ResultsSummary";
import { DataReviewGrid } from "./DataReviewGrid";
import {
  UploadConflictDialog,
  IExistingFileInfo,
  ConflictResolution,
} from "./UploadConflictDialog";
import type { UploadIntent } from "./ConversationalJobFlow";
import { HelpChatPanel } from "./HelpChatPanel";

// Services
import { getSharePointService } from "../services/ServiceFactory";
import { ExcelParserService } from "../services/ExcelParserService";
import { SummaryService } from "../services/SummaryService";
import { getComponentNormalizerService } from "../services/ComponentNormalizerService";
import { getSubstrateNormalizerService } from "../services/SubstrateNormalizerService";
import {
  collectPositiveComponents,
  generateHazards,
} from "../services/LeadInspectorService";
import { convertCsvToXlsx, isCsvFileName } from "../services/csvToXlsx";

// Models
import { IXrfReading } from "../models/IXrfReading";
import { IJobSummary } from "../models/ISummary";
import { IComponentNormalization } from "../models/INormalization";
import {
  IProcessingState,
  ProcessingStep,
  INITIAL_PROCESSING_STATE,
  STEP_DESCRIPTIONS,
} from "../models/IProcessingState";

// ============================================
// Job Metadata Interface
// ============================================
interface IJobMetadata {
  jobNumber: string;
  areaType: "Units" | "Common Areas"; // Used for save metadata; report always has both sections
  sourceFileName: string;
}

/** One skipped junk row from parse, with file context for user to fix source and re-upload */
interface IJunkReportEntry {
  fileName: string;
  areaType: "Units" | "Common Areas";
  row: number;
  reason: "noComponent" | "noLeadContent";
}

// ============================================
// Main Component
// ============================================
const XrfProcessor: React.FC<IXrfProcessorProps> = (props) => {
  const { hasTeamsContext, userDisplayName } = props;

  // Services (memoized to prevent recreation)
  const parserService = React.useMemo(() => new ExcelParserService(), []);
  const summaryService = React.useMemo(() => new SummaryService(), []);

  // Processing state
  const [state, setState] = React.useState<IProcessingState>(INITIAL_PROCESSING_STATE);
  const [readings, setReadings] = React.useState<IXrfReading[]>([]);
  const [normalizations, setNormalizations] = React.useState<IComponentNormalization[]>([]);
  const [summary, setSummary] = React.useState<IJobSummary | undefined>(undefined);
  const [jobMetadata, setJobMetadata] = React.useState<IJobMetadata | undefined>(undefined);
  /** Rows skipped as junk (no component / no lead) so user can fix source and re-upload */
  const [junkReport, setJunkReport] = React.useState<IJunkReportEntry[]>([]);

  // Conflict dialog state
  const [conflictDialogOpen, setConflictDialogOpen] = React.useState(false);
  const [existingFileInfo, setExistingFileInfo] = React.useState<IExistingFileInfo | undefined>(undefined);
  const [pendingUpload, setPendingUpload] = React.useState<{
    files: File[];
    jobNumber: string;
    areaType: "Units" | "Common Areas";
  } | undefined>(undefined);

  // Ensure conflict dialog opens when we have pending upload + existing file info (handles React batching)
  React.useEffect(() => {
    if (pendingUpload && existingFileInfo) {
      setConflictDialogOpen(true);
    }
  }, [pendingUpload, existingFileInfo]);

  // Help panel state
  const [helpPanelOpen, setHelpPanelOpen] = React.useState(false);
  const [jobNumber, setJobNumber] = React.useState("");
  const [processingAction, setProcessingAction] = React.useState<"upload" | "generate" | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = React.useState<string | null>(null);
  /** When in EDITING_COMPLETE, files chosen for uploading the "other" area type */
  const [filesForOtherArea, setFilesForOtherArea] = React.useState<File[]>([]);
  const otherAreaFileInputRef = React.useRef<HTMLInputElement>(null);

  // ============================================
  // State Helpers
  // ============================================
  const updateState = (
    step: ProcessingStep,
    progress: number,
    message?: string,
    error?: string
  ): void => {
    setState({
      step,
      progress,
      message: message || STEP_DESCRIPTIONS[step],
      error,
    });
  };

  const handleReset = (): void => {
    setState(INITIAL_PROCESSING_STATE);
    setReadings([]);
    setNormalizations([]);
    setSummary(undefined);
    setJobMetadata(undefined);
    setJunkReport([]);
  };

  // ============================================
  // Upload Only (save one or more files, no report)
  // ============================================
  const handleUploadOnly = async (
    files: File[],
    jobNum: string,
    areaType: "Units" | "Common Areas",
    uploadIntent?: UploadIntent
  ): Promise<void> => {
    setUploadSuccessMessage(null);
    if (files.length === 0) return;
    setProcessingAction("upload");
    try {
      const spService = getSharePointService();
      updateState("UPLOADING", 5, "Checking for existing data...");
      const existingData = await spService.checkExistingData(jobNum, areaType);

      // When user already chose Replace or Add in the flow, skip the dialog and proceed
      if (uploadIntent === "replace" || uploadIntent === "merge") {
        if (uploadIntent === "replace" && existingData.exists) {
          updateState("UPLOADING", 10, "Removing existing data...");
          await spService.deleteExistingData(jobNum, areaType);
        }
        updateState("PARSING", 15, "Validating files...");
        for (let i = 0; i < files.length; i++) {
          const parseResult = await parserService.parseFileObject(files[i]);
          if (parseResult.readings.length === 0) {
            const errMsg = parseResult.errors.length > 0
              ? parseResult.errors.map((e) => e.message).join("; ")
              : "No valid readings found in file";
            throw new Error(`${files[i].name}: ${errMsg}`);
          }
        }
        updateState("UPLOADING", 30, "Saving to SharePoint...");
        for (let i = 0; i < files.length; i++) {
          const pct = 30 + Math.round(((i + 1) / files.length) * 60);
          updateState("UPLOADING", pct, `Uploading ${i + 1} of ${files.length}...`);
          await spService.uploadSourceFile(files[i], { jobNumber: jobNum, areaType });
        }
        const mergeNote = uploadIntent === "merge" ? " (added to existing)" : "";
        const fileLabel = files.length === 1 ? `"${files[0].name}"` : `${files.length} files`;
        setUploadSuccessMessage(`${fileLabel} uploaded successfully for Job ${jobNum} (${areaType})${mergeNote}. Loading data for review...`);
        if (jobNum !== "TEMP") {
          handleReviewDataAfterUpload(jobNum, areaType).catch(() => { /* state updated on error */ });
        } else {
          updateState("IDLE", 0, "");
        }
        return;
      }

      if (existingData.exists) {
        const info: IExistingFileInfo = {
          fileName: existingData.sourceFile?.Title || "Unknown",
          uploadDate: existingData.sourceFile?.Created || "",
          totalReadings: existingData.processedResult?.TotalReadings || 0,
          positiveCount: existingData.processedResult?.LeadPositiveCount || 0,
          status: existingData.sourceFile?.ProcessedStatus || "Complete",
        };
        setExistingFileInfo(info);
        setPendingUpload({ files, jobNumber: jobNum, areaType });
        setConflictDialogOpen(true);
        updateState("IDLE", 0, "");
        setProcessingAction(null);
        return;
      }

      updateState("PARSING", 15, "Validating files...");
      for (let i = 0; i < files.length; i++) {
        const parseResult = await parserService.parseFileObject(files[i]);
        if (parseResult.readings.length === 0) {
          const errMsg = parseResult.errors.length > 0
            ? parseResult.errors.map((e) => e.message).join("; ")
            : "No valid readings found in file";
          throw new Error(`${files[i].name}: ${errMsg}`);
        }
      }

      updateState("UPLOADING", 30, "Saving to SharePoint...");
      for (let i = 0; i < files.length; i++) {
        const pct = 30 + Math.round(((i + 1) / files.length) * 60);
        updateState("UPLOADING", pct, `Uploading ${i + 1} of ${files.length}...`);
        await spService.uploadSourceFile(files[i], { jobNumber: jobNum, areaType });
      }

      const fileLabel = files.length === 1 ? `"${files[0].name}"` : `${files.length} files`;
      setUploadSuccessMessage(`${fileLabel} uploaded successfully for Job ${jobNum} (${areaType}). Loading data for review...`);

      if (jobNum !== "TEMP") {
        handleReviewDataAfterUpload(jobNum, areaType).catch(() => { /* state updated on error */ });
      } else {
        updateState("IDLE", 0, "");
      }
    } catch (error) {
      updateState(
        "ERROR",
        0,
        "Upload failed",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setProcessingAction(null);
    }
  };

  const handleUploadConflictResolve = async (resolution: ConflictResolution): Promise<void> => {
    setConflictDialogOpen(false);
    if (resolution === "cancel" || !pendingUpload) {
      setPendingUpload(undefined);
      setExistingFileInfo(undefined);
      setProcessingAction(null);
      return;
    }
    const { files, jobNumber: jobNum, areaType } = pendingUpload;
    setPendingUpload(undefined);
    setExistingFileInfo(undefined);
    setUploadSuccessMessage(null);
    setProcessingAction("upload");

    try {
      const spService = getSharePointService();
      if (resolution === "replace") {
        updateState("UPLOADING", 10, "Removing existing data...");
        await spService.deleteExistingData(jobNum, areaType);
      }

      updateState("PARSING", 20, "Validating files...");
      for (let i = 0; i < files.length; i++) {
        const parseResult = await parserService.parseFileObject(files[i]);
        if (parseResult.readings.length === 0) {
          throw new Error(`${files[i].name}: No valid readings found`);
        }
      }

      updateState("UPLOADING", 50, "Saving to SharePoint...");
      for (let i = 0; i < files.length; i++) {
        const pct = 50 + Math.round(((i + 1) / files.length) * 45);
        updateState("UPLOADING", pct, `Uploading ${i + 1} of ${files.length}...`);
        await spService.uploadSourceFile(files[i], { jobNumber: jobNum, areaType });
      }
      const mergeNote = resolution === "merge" ? " (added to existing)" : "";
      const fileLabel = files.length === 1 ? `"${files[0].name}"` : `${files.length} files`;
      setUploadSuccessMessage(`${fileLabel} uploaded successfully for Job ${jobNum} (${areaType})${mergeNote}. Loading data for review...`);

      if (jobNum !== "TEMP") {
        handleReviewDataAfterUpload(jobNum, areaType).catch(() => { /* state updated on error */ });
      } else {
        updateState("IDLE", 0, "");
      }
    } catch (error) {
      updateState(
        "ERROR",
        0,
        "Upload failed",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setProcessingAction(null);
    }
  };

  // ============================================
  // Review data after upload (load merged files → normalize → grid)
  // ============================================
  /** Load all source data for this job (both Units and Common Areas when both exist), merge, normalize, then show review panel and grid. */
  const handleReviewDataAfterUpload = async (
    jobNum: string,
    _areaTypeJustUploaded: "Units" | "Common Areas"
  ): Promise<void> => {
    setProcessingAction("generate");
    try {
      const spService = getSharePointService();
      updateState("UPLOADING", 5, "Loading data for job...");
      const status = await spService.getJobDataStatus(jobNum);
      if (!status.hasUnits && !status.hasCommonAreas) {
        updateState("ERROR", 0, "No data", "No data found for this job.");
        return;
      }

      const unitReadings: IXrfReading[] = [];
      const commonAreaReadings: IXrfReading[] = [];
      const sourceFileNames: string[] = [];
      const combinedJunkReport: IJunkReportEntry[] = [];

      if (status.hasUnits) {
        updateState("UPLOADING", 10, "Loading Units data...");
        const { readings, fileNames, junkReport: unitsJunk } = await loadAndMergeReadingsForArea(jobNum, "Units");
        if (readings.length > 0) {
          unitReadings.push(...readings);
          sourceFileNames.push(...fileNames);
        }
        combinedJunkReport.push(...unitsJunk);
      }

      if (status.hasCommonAreas) {
        updateState("UPLOADING", 25, "Loading Common Areas data...");
        const { readings, fileNames, junkReport: commonJunk } = await loadAndMergeReadingsForArea(jobNum, "Common Areas");
        if (readings.length > 0) {
          commonAreaReadings.push(...readings);
          if (sourceFileNames.length === 0) sourceFileNames.push(...fileNames);
          else sourceFileNames.push(...fileNames);
        }
        combinedJunkReport.push(...commonJunk);
      }

      const allReadings = [...unitReadings, ...commonAreaReadings];
      if (allReadings.length === 0) {
        updateState("ERROR", 0, "No data", "No valid readings in uploaded file(s).");
        return;
      }

      setJunkReport(combinedJunkReport);

      const areaTypeKey: "Units" | "Common Areas" = status.hasUnits ? "Units" : "Common Areas";
      const sourceFileName =
        sourceFileNames.length === 0
          ? `Job ${jobNum} data`
          : sourceFileNames.length === 1
            ? sourceFileNames[0]
            : `Job ${jobNum} (${sourceFileNames.length} files merged)`;

      setJobMetadata({
        jobNumber: jobNum,
        areaType: areaTypeKey,
        sourceFileName,
      });
      setReadings(allReadings);

      updateState("NORMALIZING", 45, "Normalizing component names...");
      const normalizerService = getComponentNormalizerService();
      const componentNames = Array.from(new Set(allReadings.map((r) => r.component)));
      const normalizedComponents = await normalizerService.normalizeComponents(
        componentNames,
        (p) => updateState("NORMALIZING", 45 + Math.round((p.processed / p.total) * 7), `Components: ${p.message}`)
      );
      setNormalizations(normalizedComponents);

      updateState("NORMALIZING", 52, "Normalizing substrate names...");
      const substrateService = getSubstrateNormalizerService();
      const { readings: withSubstrate } = await substrateService.normalizeReadings(
        allReadings,
        (p) => updateState("NORMALIZING", 52 + Math.round((p.processed / p.total) * 8), `Substrates: ${p.message}`)
      );
      setReadings(withSubstrate);

      updateState("REVIEWING", 60, "Review AI normalization suggestions...");
    } catch (error) {
      updateState(
        "ERROR",
        0,
        "Failed to load data",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setProcessingAction(null);
    }
  };

  // ============================================
  // Generate Report (load from SharePoint)
  // ============================================
  /**
   * Merge key when combining multiple files: file index + readingId so that
   * the same shot id (e.g. 1) from different files are kept as separate rows.
   */
  const readingMergeKeyWithFile = (fileIndex: number, r: IXrfReading): string =>
    `${fileIndex}_${r.readingId}`;

  const loadAndMergeReadingsForArea = async (
    jobNum: string,
    areaType: "Units" | "Common Areas"
  ): Promise<{ readings: IXrfReading[]; fileNames: string[]; junkReport: IJunkReportEntry[] }> => {
    const spService = getSharePointService();
    const allFiles = await spService.getAllSourceFilesForJob(jobNum, areaType);
    if (allFiles.length === 0) return { readings: [], fileNames: [], junkReport: [] };

    const mergedByKey = new Map<string, IXrfReading>();
    const fileNames: string[] = [];
    const junkReport: IJunkReportEntry[] = [];
    for (let i = 0; i < allFiles.length; i++) {
      const f = allFiles[i];
      fileNames.push(f.fileName);
      let buf = f.buffer;
      if (isCsvFileName(f.fileName)) buf = convertCsvToXlsx(buf);
      const pr = await parserService.parseFile(buf);
      for (const r of pr.readings) {
        const fileSuffix = `_f${i}`;
        const reading: IXrfReading = {
          ...r,
          areaType,
          readingId: r.readingId + fileSuffix,
        };
        mergedByKey.set(readingMergeKeyWithFile(i, r), reading);
      }
      const rows = pr.metadata?.skippedJunkRows ?? [];
      for (const { row, reason } of rows) {
        junkReport.push({ fileName: f.fileName, areaType, row, reason });
      }
    }
    return { readings: Array.from(mergedByKey.values()), fileNames, junkReport };
  };

  /** Load saved summary and go straight to report (no AI/normalization). */
  const handleViewReport = async (jobNum: string): Promise<void> => {
    setProcessingAction("generate");
    try {
      const spService = getSharePointService();
      const json = await spService.getLatestSummaryJsonByJob(jobNum);
      if (!json) {
        updateState("ERROR", 0, "No saved report", "No saved report found for this job. Process data first to generate a report.");
        return;
      }
      const jobSummary = summaryService.fromJson(json);
      const areaType: "Units" | "Common Areas" =
        jobSummary.unitsSummary && jobSummary.unitsSummary.totalReadings > 0
          ? "Units"
          : "Common Areas";
      setJobMetadata({
        jobNumber: jobSummary.jobNumber,
        areaType,
        sourceFileName: jobSummary.sourceFileName,
      });
      setSummary(jobSummary);
      setReadings([]);
      updateState("COMPLETE", 100, "Report loaded.");
    } catch (error) {
      updateState(
        "ERROR",
        0,
        "Failed to load report",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setProcessingAction(null);
    }
  };

  const handleConflictResolve = (resolution: ConflictResolution): void => {
    handleUploadConflictResolve(resolution).catch(() => { /* handled in promise */ });
  };

  // ============================================
  // Step 2: Normalization Approval -> Move to Editing
  // ============================================
  const handleNormalizationApprove = async (
    approved: IComponentNormalization[]
  ): Promise<void> => {
    if (!jobMetadata) {
      updateState("ERROR", 0, "Missing job metadata", "Job metadata not found");
      return;
    }

    // Build normalization lookup map
    const normMap = new Map<string, string>();
    for (const norm of approved) {
      normMap.set(norm.originalName.toLowerCase(), norm.normalizedName);
    }

    // Apply normalizations to readings
    const normalizedReadings = readings.map((r) => ({
      ...r,
      normalizedComponent:
        normMap.get(r.component.toLowerCase()) || r.component,
    }));

    // Store approved normalizations for later caching
    setNormalizations(approved);
    
    // Update readings with normalized components
    setReadings(normalizedReadings);

    // Move to editing step where user can review/edit data
    updateState("EDITING", 70, "Review and edit data before generating summary...");
  };

  const handleNormalizationCancel = (): void => {
    handleReset();
  };

  // ============================================
  // Step 3: Data Editing & Summary Generation
  // ============================================
  const handleReadingsChange = (updatedReadings: IXrfReading[]): void => {
    setReadings(updatedReadings);
  };

  const handleReNormalize = async (): Promise<void> => {
    try {
      updateState("NORMALIZING", 45, "Re-normalizing component names...");
      const normalizerService = getComponentNormalizerService();
      const componentNames = Array.from(new Set(readings.map((r) => r.component)));

      const normalizedComponents = await normalizerService.normalizeComponents(
        componentNames,
        (progress) => {
          const normalizeProgress = 45 + Math.round((progress.processed / progress.total) * 7);
          updateState("NORMALIZING", normalizeProgress, `Components: ${progress.message}`);
        }
      );

      setNormalizations(normalizedComponents);

      // Also re-normalize substrate names
      updateState("NORMALIZING", 52, "Re-normalizing substrate names...");
      const substrateNormalizerService = getSubstrateNormalizerService();
      const { readings: readingsWithSubstrate } = await substrateNormalizerService.normalizeReadings(
        readings,
        (progress) => {
          const normalizeProgress = 52 + Math.round((progress.processed / progress.total) * 8);
          updateState("NORMALIZING", normalizeProgress, `Substrates: ${progress.message}`);
        }
      );

      setReadings(readingsWithSubstrate);
      updateState("REVIEWING", 60, "Review AI normalization suggestions...");
    } catch (error) {
      console.error("Re-normalization error:", error);
      updateState(
        "ERROR",
        0,
        "Re-normalization failed",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleGenerateSummary = async (): Promise<void> => {
    if (!jobMetadata) {
      updateState("ERROR", 0, "Missing job metadata", "Job metadata not found");
      return;
    }

    try {
      updateState("SUMMARIZING", 80, "Generating HUD/EPA summary...");

      const aiCount = normalizations.filter((n) => n.source === "AI").length;
      const unitReadings = readings.filter((r) => r.areaType === "Units" || !r.areaType);
      const commonAreaReadings = readings.filter((r) => r.areaType === "Common Areas");
      const hasBoth = unitReadings.length > 0 && commonAreaReadings.length > 0;

      const jobSummary = summaryService.generateJobSummary(
        jobMetadata.jobNumber,
        jobMetadata.sourceFileName,
        commonAreaReadings.length > 0 ? commonAreaReadings : undefined,
        unitReadings.length > 0 ? unitReadings : undefined,
        aiCount
      );

      updateState("SUMMARIZING", 85, "Generating hazard recommendations (Lead Inspector AI)...");
      const positiveComponents = collectPositiveComponents(
        jobSummary.commonAreaSummary,
        jobSummary.unitsSummary
      );
      if (positiveComponents.length > 0) {
        const hazards = await generateHazards(positiveComponents);
        jobSummary.hazards = hazards;
      }

      updateState("STORING", 90, "Saving results to SharePoint...");
      const spService = getSharePointService();
      const summaryJson = summaryService.toJson(jobSummary);

      const summaryFileName = hasBoth
        ? summaryService.generateCombinedSummaryFileName(jobMetadata.jobNumber)
        : summaryService.generateSummaryFileName(jobMetadata.jobNumber, jobMetadata.areaType);

      const totalReadings = readings.length;
      const positiveCount = readings.filter((r) => r.isPositive).length;
      const uniqueComponents = new Set(readings.map((r) => r.normalizedComponent || r.component)).size;

      await spService.saveProcessedResults(summaryJson, summaryFileName, {
        jobNumber: jobMetadata.jobNumber,
        areaType: hasBoth ? "Units" : jobMetadata.areaType,
        sourceFileUrl: "",
        totalReadings,
        uniqueComponents,
        leadPositiveCount: positiveCount,
        leadPositivePercent: totalReadings > 0 ? (positiveCount / totalReadings) * 100 : 0,
      });

      // Cache new AI normalizations
      const newAINormalizations = normalizations.filter((n) => n.source === "AI");
      if (newAINormalizations.length > 0) {
        try {
          const normalizerService = getComponentNormalizerService();
          await normalizerService.saveNormalizationsToCache(newAINormalizations);
        } catch (cacheError) {
          console.warn("Failed to cache normalizations:", cacheError);
          // Non-fatal - continue
        }
      }

      // Complete!
      setSummary(jobSummary);
      updateState("COMPLETE", 100, "Processing complete!");
    } catch (error) {
      console.error("Summary/storage error:", error);
      updateState(
        "ERROR",
        0,
        "Failed to save results",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const handleCancelEditing = (): void => {
    handleReset();
  };

  /** When in EDITING_COMPLETE: upload the other area type (Units or Common Areas) and reload pipeline */
  const handleUploadOtherArea = async (): Promise<void> => {
    if (!jobMetadata || filesForOtherArea.length === 0) return;
    const files = [...filesForOtherArea];
    const otherType: "Units" | "Common Areas" =
      readings.some((r) => r.areaType === "Common Areas")
        ? "Units"
        : "Common Areas";
    setFilesForOtherArea([]);
    if (otherAreaFileInputRef.current) otherAreaFileInputRef.current.value = "";
    await handleUploadOnly(files, jobMetadata.jobNumber, otherType);
  };

  const otherAreaType = (): "Units" | "Common Areas" | null => {
    const hasUnits = readings.some((r) => r.areaType === "Units" || !r.areaType);
    const hasCommonAreas = readings.some((r) => r.areaType === "Common Areas");
    if (!hasUnits) return "Units";
    if (!hasCommonAreas) return "Common Areas";
    return null;
  };

  // ============================================
  // Render Helpers
  // ============================================
  const renderProgressBar = (): JSX.Element | null => {
    if (
      state.step === "IDLE" ||
      state.step === "COMPLETE" ||
      state.step === "ERROR" ||
      state.step === "REVIEWING" ||
      state.step === "EDITING" ||
      state.step === "EDITING_COMPLETE"
    ) {
      return null;
    }

    return (
      <ProgressIndicator
        label={state.message}
        percentComplete={state.progress / 100}
        styles={{ root: { marginBottom: 16 } }}
      />
    );
  };

  const handleStepComplete = (): void => {
    updateState("EDITING_COMPLETE", 72, "Choose next step");
  };

  const renderDataReviewGrid = (): JSX.Element | null => {
    if (state.step !== "EDITING" || !jobMetadata) {
      return null;
    }

    return (
      <DataReviewGrid
        readings={readings}
        onReadingsChange={handleReadingsChange}
        onRegenerateSummary={handleGenerateSummary}
        onReNormalize={handleReNormalize}
        onStepComplete={handleStepComplete}
        onCancel={handleCancelEditing}
        isProcessing={false}
        areaType={jobMetadata.areaType}
      />
    );
  };

  const renderEditingComplete = (): JSX.Element | null => {
    if (state.step !== "EDITING_COMPLETE" || !jobMetadata) return null;
    const other = otherAreaType();
    const isProcessing = processingAction === "upload" || processingAction === "generate";

    const addOtherFiles = (fileList: FileList | null): void => {
      if (!fileList || fileList.length === 0) return;
      const accepted = [".xlsx", ".csv"];
      const toAdd: File[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
        if (accepted.includes(ext)) toAdd.push(f);
      }
      setFilesForOtherArea((prev) => [...prev, ...toAdd]);
    };

    return (
      <Stack tokens={{ childrenGap: 24 }} styles={{ root: { marginTop: 24 } }}>
        <MessageBar messageBarType={MessageBarType.success}>
          <Text block>
            <strong>Step complete.</strong> You&apos;ve finished editing your data. You can upload the other data type next, or generate the report now.
          </Text>
        </MessageBar>
        <Stack horizontal tokens={{ childrenGap: 16 }} wrap verticalAlign="center">
          {other !== null && (
            <Stack tokens={{ childrenGap: 8 }}>
              <Text variant="medium" block>
                Upload <strong>{other}</strong> data (optional)
              </Text>
              <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
                <input
                  ref={otherAreaFileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  multiple
                  onChange={(e) => {
                    addOtherFiles(e.target.files ?? null);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                  aria-label={`Choose ${other} data files`}
                />
                <DefaultButton
                  text="Choose files"
                  iconProps={{ iconName: "Attach" }}
                  onClick={() => otherAreaFileInputRef.current?.click()}
                  disabled={isProcessing}
                />
                {filesForOtherArea.length > 0 && (
                  <>
                    <Text variant="small">
                      {filesForOtherArea.length} file(s) selected
                    </Text>
                    <PrimaryButton
                      text={processingAction === "upload" ? "Uploading…" : "Upload and continue"}
                      onClick={handleUploadOtherArea}
                      disabled={isProcessing}
                      iconProps={{ iconName: "CloudUpload" }}
                    />
                  </>
                )}
              </Stack>
            </Stack>
          )}
          <PrimaryButton
            text={processingAction === "generate" ? "Generating…" : "Generate Report"}
            onClick={handleGenerateSummary}
            disabled={isProcessing}
            iconProps={{ iconName: "ReportDocument" }}
          />
        </Stack>
      </Stack>
    );
  };

  /** Rows skipped as junk (no component / no lead). Shown at end of process so user can fix source and re-upload. */
  const renderJunkReport = (): JSX.Element | null => {
    if (junkReport.length === 0 || (state.step !== "EDITING" && state.step !== "EDITING_COMPLETE" && state.step !== "COMPLETE")) {
      return null;
    }
    const reasonLabel = (r: "noComponent" | "noLeadContent"): string =>
      r === "noComponent" ? "No component" : "No valid lead value";
    return (
      <MessageBar messageBarType={MessageBarType.warning} styles={{ root: { marginTop: 16, marginBottom: 16 } }}>
        <Stack tokens={{ childrenGap: 8 }}>
          <Text variant="mediumPlus" block>
            <strong>Skipped rows (considered junk)</strong>
          </Text>
          <Text variant="small" block>
            The following rows were skipped because they had no component or no valid lead value. Fix these in your
            source file and re-upload if you want them included.
          </Text>
          <Stack tokens={{ childrenGap: 4 }} styles={{ root: { maxHeight: 200, overflowY: "auto" } }}>
            {junkReport.map((entry, idx) => (
              <Text key={idx} variant="small" block>
                <strong>{entry.fileName}</strong> ({entry.areaType}) — Row {entry.row}: {reasonLabel(entry.reason)}
              </Text>
            ))}
          </Stack>
          <DefaultButton
            text="Re-upload"
            iconProps={{ iconName: "Upload" }}
            onClick={handleReset}
            styles={{ root: { marginTop: 4 } }}
          />
        </Stack>
      </MessageBar>
    );
  };

  const renderError = (): JSX.Element | null => {
    if (state.step !== "ERROR" || !state.error) {
      return null;
    }

    return (
      <MessageBar
        messageBarType={MessageBarType.error}
        isMultiline
        onDismiss={handleReset}
        dismissButtonAriaLabel="Close"
        styles={{ root: { marginBottom: 16 } }}
      >
        <Text variant="mediumPlus" block>
          <strong>Error:</strong> {state.error}
        </Text>
        <DefaultButton
          text="Try Again"
          onClick={handleReset}
          styles={{ root: { marginTop: 8 } }}
        />
      </MessageBar>
    );
  };

  const handleBackToEdit = (): void => {
    updateState("EDITING", 70, "Review and edit data before generating summary...");
  };

  const renderComplete = (): JSX.Element | null => {
    if (state.step !== "COMPLETE" || !summary) {
      return null;
    }

    return (
      <Stack tokens={{ childrenGap: 16 }}>
        <MessageBar messageBarType={MessageBarType.success}>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Icon iconName="CheckMark" />
            <Text>Processing complete! Results saved to SharePoint.</Text>
          </Stack>
        </MessageBar>

        <ResultsSummary
          summary={summary}
          readings={readings}
          areaType={jobMetadata?.areaType}
        />

        <Stack horizontal tokens={{ childrenGap: 12 }}>
          <DefaultButton
            text="Back to Edit Data"
            iconProps={{ iconName: "Edit" }}
            onClick={handleBackToEdit}
          />
          <PrimaryButton
            text="Process Another File"
            iconProps={{ iconName: "Add" }}
            onClick={handleReset}
          />
        </Stack>
      </Stack>
    );
  };

  // ============================================
  // Main Render
  // ============================================
  return (
    <section className={`${styles.xrfProcessor} ${hasTeamsContext ? styles.teams : ""}`}>
      {/* Header */}
      <div className={styles.welcome}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ width: "100%" }}>
          <Stack>
            <h2 style={{ margin: 0 }}>Generate Lead Paint Multifamily Report</h2>
          </Stack>
          <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center">
            <TooltipHost content="Ask AI for help using this application">
            <IconButton
              iconProps={{ iconName: "Robot" }}
              title="AI Help Assistant"
              ariaLabel="Open AI help assistant"
              onClick={() => setHelpPanelOpen(true)}
              styles={{
                root: {
                  backgroundColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  color: "white",
                  borderRadius: "50%",
                  width: 40,
                  height: 40,
                },
                rootHovered: {
                  background: "linear-gradient(135deg, #5a67d8 0%, #6b46a1 100%)",
                  color: "white",
                },
                icon: {
                  fontSize: 18,
                },
              }}
            />
          </TooltipHost>
          </Stack>
        </Stack>
      </div>

      {/* Help Chat Panel */}
      <HelpChatPanel
        isOpen={helpPanelOpen}
        onDismiss={() => setHelpPanelOpen(false)}
      />

      {/* Error Display */}
      {renderError()}

      {/* Upload success notification */}
      {uploadSuccessMessage && (
        <MessageBar
          messageBarType={MessageBarType.success}
          onDismiss={() => setUploadSuccessMessage(null)}
          dismissButtonAriaLabel="Close"
          styles={{ root: { marginBottom: 16 } }}
        >
          {uploadSuccessMessage}
        </MessageBar>
      )}

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Conflict Dialog */}
      {existingFileInfo && pendingUpload && (
        <UploadConflictDialog
          isOpen={conflictDialogOpen}
          jobNumber={pendingUpload.jobNumber}
          areaType={pendingUpload.areaType}
          existingFile={existingFileInfo}
          newFileName={pendingUpload.files.length === 1 ? pendingUpload.files[0].name : `${pendingUpload.files.length} files`}
          onResolve={handleConflictResolve}
        />
      )}

      {/* AI Review Panel */}
      <AINormalizationReview
        isOpen={state.step === "REVIEWING"}
        normalizations={normalizations}
        onApprove={handleNormalizationApprove}
        onCancel={handleNormalizationCancel}
        isLoading={state.step === "NORMALIZING"}
        loadingMessage={state.message}
      />

      {/* Data Review Grid */}
      {renderDataReviewGrid()}

      {/* After step complete: upload other type or generate report */}
      {renderEditingComplete()}

      {/* Skipped junk rows (EDITING or COMPLETE) */}
      {renderJunkReport()}

      {/* Main Content */}
      {state.step === "COMPLETE" ? (
        renderComplete()
      ) : state.step === "EDITING" || state.step === "EDITING_COMPLETE" ? (
        null // Grid or editing-complete card rendered above
      ) : state.step === "IDLE" || state.step === "ERROR" ? (
        <Stack styles={{ root: { marginTop: 24 } }}>
          {/* Conversational flow only – no tabs; start with just the question */}
          <ConversationalJobFlow
            userDisplayName={userDisplayName}
            jobNumber={jobNumber}
            onJobNumberChange={(v) => {
              setUploadSuccessMessage(null);
              setJobNumber(v);
            }}
            onUpload={handleUploadOnly}
            onViewReport={handleViewReport}
            isUploading={processingAction === "upload"}
            isGenerating={processingAction === "generate"}
          />
        </Stack>
      ) : (
        // Processing in progress - show simplified view
        <Stack tokens={{ childrenGap: 16 }} styles={{ root: { marginTop: 24 } }}>
          <MessageBar messageBarType={MessageBarType.info}>
            <Text>Processing in progress... Please wait.</Text>
          </MessageBar>
        </Stack>
      )}
    </section>
  );
};

export default XrfProcessor;
