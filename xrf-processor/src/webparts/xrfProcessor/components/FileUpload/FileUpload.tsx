import * as React from "react";
import {
  Stack,
  TextField,
  Dropdown,
  IDropdownOption,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  ProgressIndicator,
  Icon,
  Text,
} from "@fluentui/react";
import styles from "./FileUpload.module.scss";
import { getJobsApiService } from "../../services/JobsApiService";
import type { IJobsApiJob } from "../../models/IJobsApi";

export interface IFileUploadProps {
  /** Called when user submits the form */
  onSubmit: (file: File, jobNumber: string, areaType: "Units" | "Common Areas") => void;
  /** Called when user wants to load existing data */
  onLoadExisting?: (jobNumber: string, areaType: "Units" | "Common Areas") => void;
  /** Whether a file is currently being processed */
  isProcessing: boolean;
  /** Optional progress percentage (0-100) */
  progress?: number;
  /** Optional progress message */
  progressMessage?: string;
}

const areaTypeOptions: IDropdownOption[] = [
  { key: "Units", text: "Units" },
  { key: "Common Areas", text: "Common Areas" },
];

/** Accepted file extensions */
const ACCEPTED_EXTENSIONS = [".xlsx", ".csv"];

const JOB_LOOKUP_DEBOUNCE_MS = 400;

export const FileUpload: React.FC<IFileUploadProps> = ({
  onSubmit,
  onLoadExisting,
  isProcessing,
  progress,
  progressMessage,
}) => {
  const [file, setFile] = React.useState<File | undefined>(undefined);
  const [jobNumber, setJobNumber] = React.useState("");
  const [areaType, setAreaType] = React.useState<"Units" | "Common Areas">("Units");
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = React.useState(false);
  const [jobLookup, setJobLookup] = React.useState<IJobsApiJob | null>(null);
  const [jobLookupLoading, setJobLookupLoading] = React.useState(false);
  const [jobLookupError, setJobLookupError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Debounced lookup against 2ETC Jobs API (jobId = Job Number)
  React.useEffect(() => {
    const v = jobNumber.trim();
    if (!v) {
      setJobLookup(null);
      setJobLookupError(null);
      setJobLookupLoading(false);
      return;
    }
    const id = parseInt(v, 10);
    if (Number.isNaN(id)) {
      setJobLookup(null);
      setJobLookupError(null);
      setJobLookupLoading(false);
      return;
    }

    const t = window.setTimeout(() => {
      setJobLookupLoading(true);
      setJobLookupError(null);
      getJobsApiService()
        .getJobByJobId(v)
        .then((job) => {
          setJobLookup(job);
          setJobLookupError(null);
        })
        .catch((e) => {
          setJobLookup(null);
          setJobLookupError(e instanceof Error ? e.message : "Could not reach jobs API");
        })
        .finally(() => setJobLookupLoading(false));
    }, JOB_LOOKUP_DEBOUNCE_MS);

    return () => window.clearTimeout(t);
  }, [jobNumber]);

  const validateAndSetFile = (selectedFile: File | undefined): void => {
    setError(undefined);
    if (!selectedFile) return;

    // Check file extension
    const fileName = selectedFile.name.toLowerCase();
    const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
      fileName.endsWith(ext)
    );

    if (!hasValidExtension) {
      setError("Please select an Excel (.xlsx) or CSV (.csv) file");
      return;
    }

    setFile(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFile = e.target.files?.[0];
    validateAndSetFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleSubmit = (): void => {
    if (!file) {
      setError("Please select a file");
      return;
    }
    if (!jobNumber.trim()) {
      setError("Please enter a job number");
      return;
    }
    onSubmit(file, jobNumber.trim(), areaType);
  };

  const handleClearFile = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setFile(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isFormValid = file && jobNumber.trim();
  const canLoadExisting = onLoadExisting && jobNumber.trim() && !file;

  const getFileIcon = (): string => {
    if (file?.name.toLowerCase().endsWith(".csv")) {
      return "TextDocument";
    }
    return "ExcelDocument";
  };

  return (
    <Stack tokens={{ childrenGap: 16 }} className={styles.container}>
      <Text variant="xLarge" className={styles.title}>
        Upload XRF Data File
      </Text>

      {/* Drop Zone */}
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ""} ${
          file ? styles.hasFile : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleFileChange}
          style={{ display: "none" }}
          disabled={isProcessing}
        />

        <Icon iconName={getFileIcon()} className={styles.dropZoneIcon} />

        {file ? (
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Text className={styles.fileName}>{file.name}</Text>
            {!isProcessing && (
              <Icon
                iconName="Cancel"
                className={styles.clearButton}
                onClick={handleClearFile}
                title="Remove file"
              />
            )}
          </Stack>
        ) : (
          <Stack tokens={{ childrenGap: 4 }}>
            <Text className={styles.dropZoneText}>
              Drag & drop file here or click to browse
            </Text>
            <Text className={styles.dropZoneHint}>
              Accepts .xlsx and .csv files
            </Text>
          </Stack>
        )}
      </div>

      {/* Job Number */}
      <TextField
        label="Job Number"
        required
        value={jobNumber}
        onChange={(_, v) => setJobNumber(v || "")}
        placeholder="Enter 2ETC Job ID (e.g., 287459)"
        disabled={isProcessing}
        className={styles.field}
        description="Links to 2ETC jobs. Enter the numeric Job ID from the 2ETC system."
      />

      {/* 2ETC Job lookup result */}
      {jobLookupLoading && jobNumber.trim() && (
        <MessageBar messageBarType={MessageBarType.info}>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Icon iconName="Search" />
            <Text variant="small">Looking up job in 2ETC…</Text>
          </Stack>
        </MessageBar>
      )}
      {!jobLookupLoading && jobLookup && (
        <MessageBar messageBarType={MessageBarType.success}>
          <Stack tokens={{ childrenGap: 4 }}>
            <Text variant="small" className={styles.jobLinkTitle}>
              Linked to 2ETC Job {jobLookup.jobId}
            </Text>
            <Text variant="small">
              Client: {jobLookup.client.name}
              {jobLookup.facilityName ? ` · Facility: ${jobLookup.facilityName}` : ""}
              {jobLookup.facilityAddress ? ` · ${jobLookup.facilityAddress}` : ""}
            </Text>
          </Stack>
        </MessageBar>
      )}
      {!jobLookupLoading && jobLookupError && jobNumber.trim() && (
        <MessageBar messageBarType={MessageBarType.warning}>
          <Text variant="small">
            Could not verify job in 2ETC ({jobLookupError}). You can still process using this job number.
          </Text>
        </MessageBar>
      )}

      {/* Area Type */}
      <Dropdown
        label="Area Type"
        required
        selectedKey={areaType}
        options={areaTypeOptions}
        onChange={(_, opt) => setAreaType((opt?.key as "Units" | "Common Areas") || "Units")}
        disabled={isProcessing}
        className={styles.field}
      />

      {/* Error Message */}
      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          onDismiss={() => setError(undefined)}
          dismissButtonAriaLabel="Close"
        >
          {error}
        </MessageBar>
      )}

      {/* Progress */}
      {isProcessing && (
        <Stack tokens={{ childrenGap: 8 }} className={styles.progressSection}>
          <ProgressIndicator
            label={progressMessage || "Processing..."}
            percentComplete={progress !== undefined ? progress / 100 : undefined}
          />
        </Stack>
      )}

      {/* Submit Buttons */}
      <Stack horizontal tokens={{ childrenGap: 12 }}>
        <PrimaryButton
          text={isProcessing ? "Processing..." : "Process File"}
          onClick={handleSubmit}
          disabled={!isFormValid || isProcessing}
          className={styles.submitButton}
          iconProps={{ iconName: isProcessing ? "Sync" : "CloudUpload" }}
        />
        {onLoadExisting && (
          <DefaultButton
            text="Load Existing Data"
            onClick={() => onLoadExisting(jobNumber.trim(), areaType)}
            disabled={!canLoadExisting || isProcessing}
            iconProps={{ iconName: "Download" }}
            title="Load previously uploaded data for this Job ID and Area Type"
          />
        )}
      </Stack>

      {/* Help text for Load Existing */}
      {onLoadExisting && !file && jobNumber.trim() && (
        <MessageBar messageBarType={MessageBarType.info}>
          <Text variant="small">
            <strong>Tip:</strong> If you&apos;ve already uploaded data for this job, click &quot;Load Existing Data&quot; to view or regenerate the report without re-uploading.
          </Text>
        </MessageBar>
      )}
    </Stack>
  );
};

export default FileUpload;
