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
  Pivot,
  PivotItem,
  ProgressIndicator,
  Icon,
  TooltipHost,
} from "@fluentui/react";
import {
  testSharePointConnection,
  IConnectionTestResult,
} from "../services/ConnectionTest";

// Components
import { FileUpload } from "./FileUpload";
import { AINormalizationReview } from "./AINormalizationReview";
import { ResultsSummary } from "./ResultsSummary";
import { DataReviewGrid } from "./DataReviewGrid";
import {
  UploadConflictDialog,
  IExistingFileInfo,
  ConflictResolution,
} from "./UploadConflictDialog";
import { HelpChatPanel } from "./HelpChatPanel";

// Services
import { getSharePointService } from "../services/ServiceFactory";
import { ExcelParserService } from "../services/ExcelParserService";
import { SummaryService } from "../services/SummaryService";
import { getComponentNormalizerService } from "../services/ComponentNormalizerService";
import { getSubstrateNormalizerService } from "../services/SubstrateNormalizerService";

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
  file: File;
  jobNumber: string;
  areaType: "Units" | "Common Areas";
}

// ============================================
// Main Component
// ============================================
const XrfProcessor: React.FC<IXrfProcessorProps> = (props) => {
  const { hasTeamsContext, userDisplayName, sp } = props;

  // Services (memoized to prevent recreation)
  const parserService = React.useMemo(() => new ExcelParserService(), []);
  const summaryService = React.useMemo(() => new SummaryService(), []);

  // Processing state
  const [state, setState] = React.useState<IProcessingState>(INITIAL_PROCESSING_STATE);
  const [readings, setReadings] = React.useState<IXrfReading[]>([]);
  const [normalizations, setNormalizations] = React.useState<IComponentNormalization[]>([]);
  const [summary, setSummary] = React.useState<IJobSummary | undefined>(undefined);
  const [jobMetadata, setJobMetadata] = React.useState<IJobMetadata | undefined>(undefined);

  // Connection test state
  const [testResult, setTestResult] = React.useState<IConnectionTestResult | undefined>(undefined);
  const [testing, setTesting] = React.useState(false);

  // Conflict dialog state
  const [conflictDialogOpen, setConflictDialogOpen] = React.useState(false);
  const [existingFileInfo, setExistingFileInfo] = React.useState<IExistingFileInfo | undefined>(undefined);
  const [pendingUpload, setPendingUpload] = React.useState<{
    file: File;
    jobNumber: string;
    areaType: "Units" | "Common Areas";
  } | undefined>(undefined);

  // Help panel state
  const [helpPanelOpen, setHelpPanelOpen] = React.useState(false);

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
  };

  // ============================================
  // Connection Test
  // ============================================
  const handleTestConnection = async (): Promise<void> => {
    setTesting(true);
    const result = await testSharePointConnection(sp);
    setTestResult(result);
    setTesting(false);
  };

  // ============================================
  // Step 1: File Upload Processing (core logic)
  // ============================================
  const processFileUpload = async (
    file: File,
    jobNumber: string,
    areaType: "Units" | "Common Areas",
    mode: "replace" | "merge"
  ): Promise<void> => {
    setJobMetadata({ file, jobNumber, areaType });

    try {
      const spService = getSharePointService();

      // Handle replace mode - delete existing data first
      if (mode === "replace") {
        updateState("UPLOADING", 8, "Removing existing data...");
        await spService.deleteExistingData(jobNumber, areaType);
      }

      // For merge mode, get existing readings first
      let existingReadings: IXrfReading[] = [];
      if (mode === "merge") {
        updateState("UPLOADING", 8, "Loading existing readings for merge...");
        existingReadings = await spService.getExistingReadings(jobNumber, areaType);
        console.log(`Found ${existingReadings.length} existing readings to merge`);
      }

      // Upload file to SharePoint
      updateState("UPLOADING", 10, "Uploading file to SharePoint...");
      await spService.uploadSourceFile(file, {
        jobNumber,
        areaType,
      });

      // Parse Excel/CSV
      updateState("PARSING", 25, "Parsing file data...");
      const parseResult = await parserService.parseFileObject(file, (processed, total, stage) => {
        const baseProgress = stage === "reading" ? 25 : 35;
        const stageProgress = Math.round((processed / total) * 10);
        updateState("PARSING", baseProgress + stageProgress, `Parsing: ${processed}/${total} rows...`);
      });

      if (parseResult.readings.length === 0) {
        const errorMsg = parseResult.errors.length > 0
          ? parseResult.errors.map((e) => e.message).join("; ")
          : "No valid readings found in file";
        throw new Error(errorMsg);
      }

      // If there were some errors but we have readings, just log them as warnings
      if (parseResult.errors.length > 0) {
        console.warn("Parse errors (some rows skipped):", parseResult.errors);
      }

      console.log(`Parsed ${parseResult.readings.length} readings from ${parseResult.metadata.sheetName}`);

      // Merge with existing readings if in merge mode
      let allReadings = parseResult.readings;
      if (mode === "merge" && existingReadings.length > 0) {
        updateState("PARSING", 42, `Merging ${existingReadings.length} existing + ${parseResult.readings.length} new readings...`);
        
        // Create a map of existing readings by ID for efficient lookup
        const existingMap = new Map<string, IXrfReading>();
        existingReadings.forEach((r) => existingMap.set(r.readingId, r));

        // Add/update readings from new file
        parseResult.readings.forEach((newReading) => {
          existingMap.set(newReading.readingId, newReading); // New readings override existing with same ID
        });

        allReadings = Array.from(existingMap.values());
        console.log(`Merged to ${allReadings.length} total readings`);
      }

      setReadings(allReadings);

      // Show parse warnings if any
      if (parseResult.warnings.length > 0) {
        console.warn("Parse warnings:", parseResult.warnings);
      }

      // Normalize component names
      updateState("NORMALIZING", 45, "Normalizing component names with AI...");
      const normalizerService = getComponentNormalizerService();
      const componentNames = Array.from(new Set(allReadings.map((r) => r.component)));

      const normalizedComponents = await normalizerService.normalizeComponents(
        componentNames,
        (progress) => {
          const normalizeProgress = 45 + Math.round((progress.processed / progress.total) * 7);
          updateState("NORMALIZING", normalizeProgress, `Components: ${progress.message}`);
        }
      );

      setNormalizations(normalizedComponents);

      // Normalize substrate names
      updateState("NORMALIZING", 52, "Normalizing substrate names with AI...");
      const substrateNormalizerService = getSubstrateNormalizerService();
      const { readings: readingsWithSubstrate } = await substrateNormalizerService.normalizeReadings(
        allReadings,
        (progress) => {
          const normalizeProgress = 52 + Math.round((progress.processed / progress.total) * 8);
          updateState("NORMALIZING", normalizeProgress, `Substrates: ${progress.message}`);
        }
      );

      // Update readings with normalized substrates
      setReadings(readingsWithSubstrate);

      // Move to review step
      updateState("REVIEWING", 60, "Review AI normalization suggestions...");
    } catch (error) {
      console.error("Processing error:", error);
      updateState(
        "ERROR",
        0,
        "Processing failed",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  // ============================================
  // Step 1b: File Submit Handler (checks for conflicts)
  // ============================================
  const handleFileSubmit = async (
    file: File,
    jobNumber: string,
    areaType: "Units" | "Common Areas"
  ): Promise<void> => {
    console.log("Processing file:", { fileName: file.name, jobNumber, areaType });

    try {
      // Check for existing data first
      updateState("UPLOADING", 5, "Checking for existing data...");
      const spService = getSharePointService();
      const existingData = await spService.checkExistingData(jobNumber, areaType);

      if (existingData.exists) {
        // Show conflict dialog
        const info: IExistingFileInfo = {
          fileName: existingData.sourceFile?.Title || existingData.processedResult?.Title || "Unknown",
          uploadDate: existingData.sourceFile?.Created || existingData.processedResult?.Created || "",
          totalReadings: existingData.processedResult?.TotalReadings || 0,
          positiveCount: existingData.processedResult?.LeadPositiveCount || 0,
          status: existingData.sourceFile?.ProcessedStatus || "Complete",
        };

        setExistingFileInfo(info);
        setPendingUpload({ file, jobNumber, areaType });
        setConflictDialogOpen(true);
        updateState("IDLE", 0, ""); // Reset state while waiting for user decision
        return;
      }

      // No conflict - proceed with upload
      await processFileUpload(file, jobNumber, areaType, "replace");
    } catch (error) {
      console.error("Processing error:", error);
      updateState(
        "ERROR",
        0,
        "Processing failed",
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  // Handle conflict resolution
  const handleConflictResolve = async (resolution: ConflictResolution): Promise<void> => {
    setConflictDialogOpen(false);

    if (resolution === "cancel" || !pendingUpload) {
      setPendingUpload(undefined);
      setExistingFileInfo(undefined);
      return;
    }

    const { file, jobNumber, areaType } = pendingUpload;
    setPendingUpload(undefined);
    setExistingFileInfo(undefined);

    await processFileUpload(file, jobNumber, areaType, resolution);
  };

  // ============================================
  // Load Existing Data (without re-uploading)
  // ============================================
  const handleLoadExisting = async (
    jobNumber: string,
    areaType: "Units" | "Common Areas"
  ): Promise<void> => {
    console.log("Loading existing data:", { jobNumber, areaType });

    try {
      updateState("UPLOADING", 5, "Checking for existing data...");
      const spService = getSharePointService();

      // Check if data exists
      const existingData = await spService.checkExistingData(jobNumber, areaType);
      if (!existingData.exists) {
        updateState(
          "ERROR",
          0,
          "No existing data found",
          `No data found for Job ${jobNumber} (${areaType}). Please upload a file first.`
        );
        return;
      }

      // Try to get the source file and re-parse it
      updateState("UPLOADING", 15, "Loading source file from SharePoint...");
      const sourceFile = await spService.getSourceFileForJob(jobNumber, areaType);

      if (!sourceFile) {
        updateState(
          "ERROR",
          0,
          "Source file not found",
          `The source file for Job ${jobNumber} (${areaType}) could not be found. You may need to re-upload the file.`
        );
        return;
      }

      // Create a File-like object from the buffer for the job metadata
      const blob = new Blob([sourceFile.buffer], { 
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
      });
      const fileObject = new File([blob], sourceFile.fileName, { type: blob.type });
      
      setJobMetadata({ file: fileObject, jobNumber, areaType });

      // Parse the file
      updateState("PARSING", 25, "Parsing file data...");
      const parseResult = await parserService.parseFile(sourceFile.buffer, (processed, total, stage) => {
        const baseProgress = stage === "reading" ? 25 : 35;
        const stageProgress = Math.round((processed / total) * 10);
        updateState("PARSING", baseProgress + stageProgress, `Parsing: ${processed}/${total} rows...`);
      });

      if (parseResult.readings.length === 0) {
        const errorMsg = parseResult.errors.length > 0
          ? parseResult.errors.map((e) => e.message).join("; ")
          : "No valid readings found in file";
        throw new Error(errorMsg);
      }

      console.log(`Parsed ${parseResult.readings.length} readings from existing file`);
      setReadings(parseResult.readings);

      // Normalize component names
      updateState("NORMALIZING", 45, "Normalizing component names with AI...");
      const normalizerService = getComponentNormalizerService();
      const componentNames = Array.from(new Set(parseResult.readings.map((r) => r.component)));

      const normalizedComponents = await normalizerService.normalizeComponents(
        componentNames,
        (progress) => {
          const normalizeProgress = 45 + Math.round((progress.processed / progress.total) * 7);
          updateState("NORMALIZING", normalizeProgress, `Components: ${progress.message}`);
        }
      );

      setNormalizations(normalizedComponents);

      // Normalize substrate names
      updateState("NORMALIZING", 52, "Normalizing substrate names with AI...");
      const substrateNormalizerService = getSubstrateNormalizerService();
      const { readings: readingsWithSubstrate } = await substrateNormalizerService.normalizeReadings(
        parseResult.readings,
        (progress) => {
          const normalizeProgress = 52 + Math.round((progress.processed / progress.total) * 8);
          updateState("NORMALIZING", normalizeProgress, `Substrates: ${progress.message}`);
        }
      );

      // Update readings with normalized substrates
      setReadings(readingsWithSubstrate);

      // Move to review step
      updateState("REVIEWING", 60, "Review AI normalization suggestions...");
    } catch (error) {
      console.error("Load existing data error:", error);
      updateState(
        "ERROR",
        0,
        "Failed to load existing data",
        error instanceof Error ? error.message : String(error)
      );
    }
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

      // Generate summary based on area type
      const aiCount = normalizations.filter((n) => n.source === "AI").length;
      const jobSummary = summaryService.generateJobSummary(
        jobMetadata.jobNumber,
        jobMetadata.file.name,
        jobMetadata.areaType === "Common Areas" ? readings : undefined,
        jobMetadata.areaType === "Units" ? readings : undefined,
        aiCount
      );

      // Save results to SharePoint
      updateState("STORING", 90, "Saving results to SharePoint...");
      const spService = getSharePointService();

      const summaryJson = summaryService.toJson(jobSummary);
      const summaryFileName = summaryService.generateSummaryFileName(
        jobMetadata.jobNumber,
        jobMetadata.areaType
      );

      // Calculate stats for metadata
      const totalReadings = readings.length;
      const positiveCount = readings.filter((r) => r.isPositive).length;
      const uniqueComponents = new Set(readings.map((r) => r.normalizedComponent || r.component)).size;

      await spService.saveProcessedResults(summaryJson, summaryFileName, {
        jobNumber: jobMetadata.jobNumber,
        areaType: jobMetadata.areaType,
        sourceFileUrl: "", // Could be retrieved from upload result if needed
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

  // ============================================
  // Render Helpers
  // ============================================
  const renderProgressBar = (): JSX.Element | null => {
    if (
      state.step === "IDLE" ||
      state.step === "COMPLETE" ||
      state.step === "ERROR" ||
      state.step === "REVIEWING" ||
      state.step === "EDITING"
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
        onCancel={handleCancelEditing}
        isProcessing={false}
        areaType={jobMetadata.areaType}
      />
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
            <h2 style={{ margin: 0 }}>LBP Multifamily Convert</h2>
            <Text variant="medium">Welcome, {userDisplayName}!</Text>
          </Stack>
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
      </div>

      {/* Help Chat Panel */}
      <HelpChatPanel
        isOpen={helpPanelOpen}
        onDismiss={() => setHelpPanelOpen(false)}
      />

      {/* Error Display */}
      {renderError()}

      {/* Progress Bar */}
      {renderProgressBar()}

      {/* Conflict Dialog */}
      {existingFileInfo && pendingUpload && (
        <UploadConflictDialog
          isOpen={conflictDialogOpen}
          jobNumber={pendingUpload.jobNumber}
          areaType={pendingUpload.areaType}
          existingFile={existingFileInfo}
          newFileName={pendingUpload.file.name}
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

      {/* Main Content */}
      {state.step === "COMPLETE" ? (
        renderComplete()
      ) : state.step === "EDITING" ? (
        null // DataReviewGrid is rendered above
      ) : state.step === "IDLE" || state.step === "ERROR" ? (
        <Pivot styles={{ root: { marginTop: 24 } }}>
          {/* File Upload Tab */}
          <PivotItem headerText="Process File" itemIcon="Upload">
            <Stack tokens={{ childrenGap: 16 }} styles={{ root: { marginTop: 16 } }}>
              <FileUpload
                onSubmit={handleFileSubmit}
                onLoadExisting={handleLoadExisting}
                isProcessing={
                  state.step !== "IDLE" && state.step !== "ERROR" && state.step !== "COMPLETE"
                }
                progress={state.progress}
                progressMessage={state.message}
              />
            </Stack>
          </PivotItem>

          {/* Connection Test Tab */}
          <PivotItem headerText="Connection Test" itemIcon="PlugConnected">
            <Stack tokens={{ childrenGap: 16 }} styles={{ root: { marginTop: 16 } }}>
              <Text variant="large" block>
                Test your SharePoint connection before proceeding with data processing.
              </Text>

              <PrimaryButton
                text={testing ? "Testing..." : "Test SharePoint Connection"}
                onClick={handleTestConnection}
                disabled={testing}
                styles={{ root: { maxWidth: 250 } }}
              />

              {testResult && (
                <div>
                  <MessageBar
                    messageBarType={
                      testResult.success ? MessageBarType.success : MessageBarType.error
                    }
                  >
                    {testResult.success ? "Connection successful!" : "Connection failed"}
                  </MessageBar>

                  <Stack tokens={{ childrenGap: 8 }} styles={{ root: { marginTop: 12 } }}>
                    <Text>
                      <strong>Can Read:</strong> {testResult.canRead ? "✅ Yes" : "❌ No"}
                    </Text>
                    <Text>
                      <strong>Can Write:</strong>{" "}
                      {testResult.canWrite ? "✅ Yes" : "⚠️ Skipped (expected)"}
                    </Text>
                    {testResult.error && (
                      <MessageBar messageBarType={MessageBarType.error}>
                        <strong>Error:</strong> {testResult.error}
                      </MessageBar>
                    )}
                    {testResult.details && (
                      <MessageBar messageBarType={MessageBarType.info}>
                        <strong>Details:</strong> {testResult.details}
                      </MessageBar>
                    )}
                  </Stack>
                </div>
              )}
            </Stack>
          </PivotItem>
        </Pivot>
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
