import * as React from "react";
import {
  Stack,
  TextField,
  PrimaryButton,
  MessageBar,
  MessageBarType,
  Icon,
  Text,
  Link,
  Spinner,
  SpinnerSize,
} from "@fluentui/react";
import styles from "./ConversationalJobFlow.module.scss";
import { getJobLookupService } from "../../services/JobLookupService";
import { getSharePointService } from "../../services/ServiceFactory";
import { getOpenAIService } from "../../services/OpenAIService";
import type { IJobLookupResult } from "../../models/IJobLookup";

const ACCEPTED_EXTENSIONS = [".xlsx", ".csv"];

export interface IJobDataStatus {
  hasUnits: boolean;
  hasCommonAreas: boolean;
}

export type UploadIntent = "replace" | "merge";

export interface IConversationalJobFlowProps {
  userDisplayName: string;
  jobNumber: string;
  onJobNumberChange: (value: string) => void;
  onUpload: (files: File[], jobNumber: string, areaType: "Units" | "Common Areas", intent?: UploadIntent) => void;
  /** When job has existing data: go straight to saved summary (no AI re-run) */
  onViewReport: (jobNumber: string) => void;
  isUploading: boolean;
  isGenerating: boolean;
}

type FlowStep = "job_input" | "job_result" | "area_choice" | "upload";

export const ConversationalJobFlow: React.FC<IConversationalJobFlowProps> = ({
  userDisplayName,
  jobNumber,
  onJobNumberChange,
  onUpload,
  onViewReport,
  isUploading,
  isGenerating,
}) => {
  const [flowStep, setFlowStep] = React.useState<FlowStep>("job_input");
  const [files, setFiles] = React.useState<File[]>([]);
  const [areaType, setAreaType] = React.useState<"Units" | "Common Areas">("Units");
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = React.useState(false);
  const [skippedTemporary, setSkippedTemporary] = React.useState(false);
  const [jobLookup, setJobLookup] = React.useState<IJobLookupResult | null>(null);
  const [jobLookupLoading, setJobLookupLoading] = React.useState(false);
  const [jobStatus, setJobStatus] = React.useState<IJobDataStatus | null>(null);
  const [stepMessage, setStepMessage] = React.useState<string>("");
  const [stepMessageLoading, setStepMessageLoading] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const trimmedJob = jobNumber.trim();
  const effectiveJobNumber = skippedTemporary ? "TEMP" : trimmedJob;
  const isProcessing = isUploading || isGenerating;
  const areaTypeLabel = areaType === "Common Areas" ? "Common Areas" : "Units";

  // Job lookup runs only when user clicks Find (no debounce)
  const handleFindClick = (): void => {
    if (!trimmedJob) return;
    setJobLookupLoading(true);
    setJobLookup(null);
    getJobLookupService()
      .findJobByJobNumber(trimmedJob)
      .then((job) => {
        setJobLookup(job);
        setFlowStep("job_result");
      })
      .catch(() => {
        setJobLookup(null);
        setFlowStep("job_result");
      })
      .finally(() => setJobLookupLoading(false));
  };

  const handleSkipClick = (): void => {
    setSkippedTemporary(true);
    onJobNumberChange("");
    setFlowStep("job_result");
  };

  const handleNextAfterJob = (): void => {
    setFlowStep("area_choice");
  };

  const handleAreaChoice = (choice: "Units" | "Common Areas"): void => {
    setAreaType(choice);
    setFlowStep("upload");
  };

  // Job data status (for Generate Report) – fetch only after we have a job result
  React.useEffect(() => {
    if (flowStep === "job_input" || flowStep === "area_choice" || skippedTemporary || !trimmedJob) {
      setJobStatus(null);
      return;
    }
    let cancelled = false;
    getSharePointService()
      .getJobDataStatus(trimmedJob)
      .then((s) => { if (!cancelled) setJobStatus(s); })
      .catch(() => { if (!cancelled) setJobStatus(null); });
    return () => { cancelled = true; };
  }, [flowStep, trimmedJob, skippedTemporary]);

  // One conversational message per step
  const stepIdForMessage =
    flowStep === "job_input"
      ? "job_number"
      : flowStep === "job_result"
        ? "job_result"
        : flowStep === "area_choice"
          ? "area_type"
          : flowStep === "upload" && files.length > 0
            ? "ready"
            : "file_upload";

  React.useEffect(() => {
    setStepMessageLoading(true);
    const ctx = {
      userName: userDisplayName || undefined,
      jobNumber: trimmedJob || undefined,
      jobFound: !!jobLookup,
      hasExistingData: !!(jobStatus && (jobStatus.hasUnits || jobStatus.hasCommonAreas)),
      hasUnits: jobStatus?.hasUnits,
      hasCommonAreas: jobStatus?.hasCommonAreas,
      areaType,
    };
    getOpenAIService()
      .generateConversationStepMessage(stepIdForMessage, ctx)
      .then((msg) => {
        const noJobFoundMessage = "There's no data associated with that job. Click Next to upload your data.";
        const hasData = !!(jobStatus && (jobStatus.hasUnits || jobStatus.hasCommonAreas));
        const finalMessage =
          flowStep === "job_result" && !jobLookup && !skippedTemporary && !hasData
            ? noJobFoundMessage
            : msg;
        setStepMessage(finalMessage);
      })
      .catch(() => {
        const fallback =
          flowStep === "job_input"
            ? `Hey ${userDisplayName || "there"}, enter the job number below so we can look it up. You can also skip for a quick test.`
            : flowStep === "job_result" && !jobLookup && !skippedTemporary && !(jobStatus && (jobStatus.hasUnits || jobStatus.hasCommonAreas))
              ? "There's no data associated with that job. Click Next to upload your data."
              : flowStep === "job_result"
                ? "What would you like to do next?"
                : flowStep === "area_choice"
                  ? "Are you uploading Units or Common Areas?"
                  : flowStep === "upload"
                    ? "Upload one or many files with the raw data. You can select multiple .xlsx or .csv files."
                    : "Ready to upload? Click the button below.";
        setStepMessage(fallback);
      })
      .finally(() => setStepMessageLoading(false));
  }, [flowStep, stepIdForMessage, userDisplayName, trimmedJob, jobLookup, jobStatus, areaType, files.length]);

  const validateAndAddFiles = (newFiles: FileList | File[] | null): void => {
    setError(undefined);
    if (!newFiles || newFiles.length === 0) return;
    const toAdd: File[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i];
      const fileName = f.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
        setError("All files must be Excel (.xlsx) or CSV (.csv)");
        return;
      }
      toAdd.push(f);
    }
    setFiles((prev) => [...prev, ...toAdd]);
  };

  const removeFile = (index: number): void => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(undefined);
  };

  const clearFiles = (): void => {
    setFiles([]);
    setError(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = (intent?: UploadIntent): void => {
    if (files.length === 0) {
      setError("Please select one or more files");
      return;
    }
    if (!effectiveJobNumber) return;
    onUpload(files, effectiveJobNumber, areaType, intent);
    clearFiles();
  };

  const hasExistingData = !!(jobStatus && (jobStatus.hasUnits || jobStatus.hasCommonAreas));
  const hasExistingDataForThisArea =
    (areaType === "Units" && jobStatus?.hasUnits) || (areaType === "Common Areas" && jobStatus?.hasCommonAreas);

  const renderMessage = (): React.ReactNode =>
    stepMessageLoading ? (
      <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
        <Spinner size={SpinnerSize.small} />
        <Text variant="small">One moment…</Text>
      </Stack>
    ) : (
      <Text variant="medium" styles={{ root: { whiteSpace: "pre-wrap" } }}>
        {stepMessage}
      </Text>
    );

  return (
    <Stack tokens={{ childrenGap: 24 }} className={styles.container}>
      {/* Step 1: Job number – question + input in one bordered block */}
      {flowStep === "job_input" && (
        <div className={styles.conversationBlock}>
          <div className={`${styles.messageText} ${stepMessageLoading ? styles.messageTextLoading : ""}`}>
            {renderMessage()}
          </div>
          <div className={styles.stepContent}>
            <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="end" styles={{ root: { flexWrap: "wrap" } }}>
              <TextField
                value={jobNumber}
                onChange={(_, v) => onJobNumberChange(v || "")}
                placeholder="Job number"
                disabled={isProcessing}
                className={styles.field}
                styles={{ root: { minWidth: 160 } }}
                aria-label="Job number"
              />
              <PrimaryButton
                text="Find"
                onClick={handleFindClick}
                disabled={!trimmedJob || jobLookupLoading || isProcessing}
                iconProps={{ iconName: "Search" }}
              />
            </Stack>
            <Link
              className={styles.skipLink}
              onClick={handleSkipClick}
              disabled={isProcessing}
              styles={{ root: { display: "block", marginTop: 8 } }}
            >
              Skip for now — do a temporary test with my data
            </Link>
            {jobLookupLoading && (
              <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }} styles={{ root: { marginTop: 12 } }}>
                <Spinner size={SpinnerSize.small} />
                <Text variant="small">Looking up job…</Text>
              </Stack>
            )}
          </div>
        </div>
      )}

      {/* Step 2: After Find or Skip – question + result + Next in one block */}
      {flowStep === "job_result" && (
        <div className={styles.conversationBlock}>
          <div className={`${styles.messageText} ${stepMessageLoading ? styles.messageTextLoading : ""}`}>
            {renderMessage()}
          </div>
          <div className={styles.stepContent}>
            {skippedTemporary ? (
              <Text variant="medium" block className={styles.replyText}>
                Skipped job data. You can upload files for a temporary test run.
              </Text>
            ) : jobLookup ? (
              <Stack tokens={{ childrenGap: 4 }} className={styles.replyText}>
                <Text variant="medium">
                  <strong>Job {jobLookup.jobId}</strong>
                  {jobLookup.year && ` (${jobLookup.year})`}
                </Text>
                {(jobLookup.client?.name || jobLookup.facilityAddress) && (
                  <Text variant="medium">
                    {jobLookup.client?.name && `Client: ${jobLookup.client.name}`}
                    {jobLookup.facilityAddress && ` · ${jobLookup.facilityAddress}`}
                  </Text>
                )}
                {jobLookup.folderUrl && (
                  <Link href={jobLookup.folderUrl} target="_blank" rel="noopener noreferrer">
                    Open job folder in ETC Files
                  </Link>
                )}
              </Stack>
            ) : hasExistingData ? (
              <Stack tokens={{ childrenGap: 4 }} className={styles.replyText}>
                <Text variant="medium">
                  <strong>Job {trimmedJob}</strong> — You have existing data for this job in the app.
                </Text>
                <Text variant="small" block styles={{ root: { color: "#605e5c" } }}>
                  This job wasn’t found in ETC Files (the external job folder list). You can still generate a report or upload more data.
                </Text>
              </Stack>
            ) : null}
            {skippedTemporary ? (
              <PrimaryButton
                text="Next"
                onClick={handleNextAfterJob}
                disabled={isProcessing}
                iconProps={{ iconName: "Forward" }}
                styles={{ root: { marginTop: 16 } }}
              />
            ) : hasExistingData ? (
              <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center" styles={{ root: { marginTop: 16, flexWrap: "wrap" } }}>
                <PrimaryButton
                  text={isGenerating ? "Loading…" : "View Report"}
                  onClick={() => onViewReport(trimmedJob)}
                  disabled={isProcessing}
                  iconProps={{ iconName: "ReportDocument" }}
                />
                <PrimaryButton
                  text="Upload Data"
                  onClick={handleNextAfterJob}
                  disabled={isProcessing}
                  iconProps={{ iconName: "CloudUpload" }}
                />
              </Stack>
            ) : (
              <PrimaryButton
                text="Next"
                onClick={handleNextAfterJob}
                disabled={isProcessing}
                iconProps={{ iconName: "Forward" }}
                styles={{ root: { marginTop: 16 } }}
              />
            )}
          </div>
        </div>
      )}

      {/* Step 3: Units or Common Areas – question + buttons in one block */}
      {flowStep === "area_choice" && (
        <div className={styles.conversationBlock}>
          <div className={`${styles.messageText} ${stepMessageLoading ? styles.messageTextLoading : ""}`}>
            {renderMessage()}
          </div>
          <div className={styles.stepContent}>
            <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center" styles={{ root: { flexWrap: "wrap" } }}>
              <PrimaryButton
                text="Units"
                onClick={() => handleAreaChoice("Units")}
                disabled={isProcessing}
              />
              <PrimaryButton
                text="Common Areas"
                onClick={() => handleAreaChoice("Common Areas")}
                disabled={isProcessing}
              />
            </Stack>
          </div>
        </div>
      )}

      {/* Step 4: Upload – question + area + dropzone + actions in one block */}
      {flowStep === "upload" && (
        <div className={styles.conversationBlock}>
          <div className={`${styles.messageText} ${stepMessageLoading ? styles.messageTextLoading : ""}`}>
            {renderMessage()}
          </div>
          <div className={styles.stepContent}>
            <Text variant="small" block styles={{ root: { marginBottom: 12 } }}>
              You chose <strong>{areaTypeLabel}</strong>.
              <Link onClick={() => setFlowStep("area_choice")} disabled={isProcessing} styles={{ root: { marginLeft: 8 } }}>
                Change
              </Link>
            </Text>

            <div
              className={`${styles.dropZone} ${isDragging ? "dragging" : ""} ${files.length > 0 ? styles.hasFile : ""}`}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                validateAndAddFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(",")}
                multiple
                onChange={(e) => {
                  validateAndAddFiles(e.target.files);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
                disabled={isProcessing}
                aria-label="Choose XRF data files (.xlsx or .csv)"
              />
              <Icon iconName="ExcelDocument" style={{ fontSize: 48, color: "#605e5c", marginBottom: 12, display: "block" }} />
              {files.length > 0 ? (
                <Stack tokens={{ childrenGap: 4 }} styles={{ root: { width: "100%", alignItems: "center" } }}>
                  <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                    {files.length} file{files.length !== 1 ? "s" : ""} selected
                  </Text>
                  <Stack tokens={{ childrenGap: 2 }} styles={{ root: { maxHeight: 120, overflow: "auto", width: "100%" } }}>
                    {files.map((f, i) => (
                      <Stack key={`${f.name}-${i}`} horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                        <Text variant="small" styles={{ root: { flex: 1, overflow: "hidden", textOverflow: "ellipsis" } }}>
                          {f.name}
                        </Text>
                        <Link onClick={() => removeFile(i)} disabled={isProcessing}>Remove</Link>
                      </Stack>
                    ))}
                  </Stack>
                  <Link onClick={(ev) => { ev.stopPropagation(); clearFiles(); }} disabled={isProcessing}>Clear all</Link>
                </Stack>
              ) : (
                <>
                  <Text variant="medium" block>Drop files here or click to browse</Text>
                  <Text variant="small" styles={{ root: { color: "#605e5c" } }}>.xlsx and .csv</Text>
                </>
              )}
            </div>

            {hasExistingDataForThisArea && files.length > 0 ? (
              <Stack tokens={{ childrenGap: 12 }} styles={{ root: { marginTop: 16 } }}>
                <Text variant="small" block styles={{ root: { marginBottom: 4 } }}>
                  This job already has data for <strong>{areaTypeLabel}</strong>. Do you want to wipe it out or add to it?
                </Text>
                <Stack horizontal tokens={{ childrenGap: 12 }} verticalAlign="center" styles={{ root: { flexWrap: "wrap" } }}>
                  <PrimaryButton
                    text={isUploading ? "Uploading…" : "Replace existing data"}
                    onClick={() => handleUpload("replace")}
                    disabled={!effectiveJobNumber || isProcessing}
                    iconProps={{ iconName: "Delete" }}
                  />
                  <PrimaryButton
                    text={isUploading ? "Uploading…" : "Add to existing data"}
                    onClick={() => handleUpload("merge")}
                    disabled={!effectiveJobNumber || isProcessing}
                    iconProps={{ iconName: "Add" }}
                  />
                </Stack>
              </Stack>
            ) : (
              <PrimaryButton
                text={isUploading ? "Processing…" : "Process Data"}
                onClick={() => handleUpload()}
                disabled={files.length === 0 || !effectiveJobNumber || isProcessing}
                iconProps={{ iconName: "CloudUpload" }}
                styles={{ root: { marginTop: 16 } }}
              />
            )}
          </div>
        </div>
      )}

      {error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(undefined)}>
          {error}
        </MessageBar>
      )}
    </Stack>
  );
};
