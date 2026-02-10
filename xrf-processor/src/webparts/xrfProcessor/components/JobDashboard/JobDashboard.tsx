import * as React from "react";
import {
  Stack,
  TextField,
  Dropdown,
  IDropdownOption,
  PrimaryButton,
  MessageBar,
  MessageBarType,
  Icon,
  Text,
  Link,
} from "@fluentui/react";
import styles from "./JobDashboard.module.scss";
import { getJobLookupService } from "../../services/JobLookupService";
import { getSharePointService } from "../../services/ServiceFactory";
import type { IJobLookupResult } from "../../models/IJobLookup";

const ACCEPTED_EXTENSIONS = [".xlsx", ".csv"];
const JOB_LOOKUP_DEBOUNCE_MS = 400;
const JOB_STATUS_DEBOUNCE_MS = 500;

const areaTypeOptions: IDropdownOption[] = [
  { key: "Units", text: "Units" },
  { key: "Common Areas", text: "Common Areas" },
];

export interface IJobDataStatus {
  hasUnits: boolean;
  hasCommonAreas: boolean;
}

export interface IJobDashboardProps {
  jobNumber: string;
  onJobNumberChange: (value: string) => void;
  onUpload: (file: File, jobNumber: string, areaType: "Units" | "Common Areas") => void;
  onGenerateReport: (jobNumber: string) => void;
  isUploading: boolean;
  isGenerating: boolean;
}

export const JobDashboard: React.FC<IJobDashboardProps> = ({
  jobNumber,
  onJobNumberChange,
  onUpload,
  onGenerateReport,
  isUploading,
  isGenerating,
}) => {
  const [file, setFile] = React.useState<File | undefined>(undefined);
  const [areaType, setAreaType] = React.useState<"Units" | "Common Areas">("Units");
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = React.useState(false);
  const [jobLookup, setJobLookup] = React.useState<IJobLookupResult | null>(null);
  const [jobLookupLoading, setJobLookupLoading] = React.useState(false);
  const [jobLookupError, setJobLookupError] = React.useState<string | null>(null);
  const [jobStatus, setJobStatus] = React.useState<IJobDataStatus | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const trimmedJob = jobNumber.trim();

  // Job lookup (ETC Files SharePoint library)
  React.useEffect(() => {
    if (!trimmedJob) {
      setJobLookup(null);
      setJobLookupError(null);
      setJobLookupLoading(false);
      return;
    }
    const t = window.setTimeout(() => {
      setJobLookupLoading(true);
      setJobLookupError(null);
      getJobLookupService()
        .findJobByJobNumber(trimmedJob)
        .then((job) => {
          setJobLookup(job);
          setJobLookupError(null);
        })
        .catch((e) => {
          setJobLookup(null);
          setJobLookupError(e instanceof Error ? e.message : "Could not find job in ETC Files");
        })
        .finally(() => setJobLookupLoading(false));
    }, JOB_LOOKUP_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [trimmedJob]);

  // Job data status (SharePoint)
  React.useEffect(() => {
    if (!trimmedJob) {
      setJobStatus(null);
      setStatusLoading(false);
      return;
    }
    const t = window.setTimeout(() => {
      setStatusLoading(true);
      getSharePointService()
        .getJobDataStatus(trimmedJob)
        .then(setJobStatus)
        .catch(() => setJobStatus(null))
        .finally(() => setStatusLoading(false));
    }, JOB_STATUS_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [trimmedJob]);

  const validateAndSetFile = (selectedFile: File | undefined): void => {
    setError(undefined);
    if (!selectedFile) return;
    const fileName = selectedFile.name.toLowerCase();
    const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
    if (!hasValidExtension) {
      setError("Please select an Excel (.xlsx) or CSV (.csv) file");
      return;
    }
    setFile(selectedFile);
  };

  const handleUpload = (): void => {
    if (!file || !trimmedJob) {
      setError(file ? "Please enter a job number" : "Please select a file");
      return;
    }
    onUpload(file, trimmedJob, areaType);
    setFile(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canGenerate = !!trimmedJob;
  const isProcessing = isUploading || isGenerating;
  const hasData = jobStatus && (jobStatus.hasUnits || jobStatus.hasCommonAreas);

  const getFileIcon = (): string =>
    file?.name.toLowerCase().endsWith(".csv") ? "TextDocument" : "ExcelDocument";

  return (
    <Stack tokens={{ childrenGap: 24 }} className={styles.container}>
      {/* Job Number + Generate Report at top */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Job Selection</h3>
        <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="end" className={styles.jobRow}>
          <TextField
            label="Job Number"
            required
            value={jobNumber}
            onChange={(_, v) => onJobNumberChange(v || "")}
            placeholder="Enter job number (e.g., 287459)"
            disabled={isProcessing}
            className={styles.field}
            styles={{ root: { minWidth: 220 } }}
          />
          <PrimaryButton
            text={isGenerating ? "Generating…" : "Generate Report"}
            onClick={() => onGenerateReport(trimmedJob)}
            disabled={!canGenerate || isProcessing}
            iconProps={{ iconName: "ReportDocument" }}
          />
        </Stack>
        {jobLookupLoading && trimmedJob && (
          <MessageBar messageBarType={MessageBarType.info} styles={{ root: { marginTop: 12 } }}>
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
              <Icon iconName="Search" />
              <Text variant="small">Looking up job in ETC Files…</Text>
            </Stack>
          </MessageBar>
        )}
        {!jobLookupLoading && jobLookup && (
          <MessageBar messageBarType={MessageBarType.success} styles={{ root: { marginTop: 12 } }}>
            <Stack tokens={{ childrenGap: 4 }}>
              <Text variant="small">
                <strong>Job {jobLookup.jobId} found in ETC Files</strong>
                {jobLookup.year && ` (${jobLookup.year})`}
              </Text>
              {(jobLookup.client?.name || jobLookup.facilityAddress) && (
                <Text variant="small">
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
          </MessageBar>
        )}
        {!jobLookupLoading && jobLookupError && trimmedJob && (
          <MessageBar messageBarType={MessageBarType.warning} styles={{ root: { marginTop: 12 } }}>
            <Text variant="small">Could not find this job in ETC Files ({jobLookupError}). You can still use this job number.</Text>
          </MessageBar>
        )}

        {trimmedJob && (
          <div className={styles.jobStatusCard} style={{ marginTop: 16 }}>
            <Text variant="medium" styles={{ root: { fontWeight: 600, marginRight: 8 } }}>
              Data status for Job {trimmedJob}:
            </Text>
            {statusLoading ? (
              <Text variant="small">Checking…</Text>
            ) : jobStatus ? (
              <Stack horizontal tokens={{ childrenGap: 24 }}>
                <span className={jobStatus.hasUnits ? styles.statusReady : styles.statusMissing}>
                  <Icon iconName={jobStatus.hasUnits ? "CheckMark" : "Remove"} />
                  Units {jobStatus.hasUnits ? "uploaded" : "not yet"}
                </span>
                <span className={jobStatus.hasCommonAreas ? styles.statusReady : styles.statusMissing}>
                  <Icon iconName={jobStatus.hasCommonAreas ? "CheckMark" : "Remove"} />
                  Common Areas {jobStatus.hasCommonAreas ? "uploaded" : "not yet"}
                </span>
              </Stack>
            ) : null}
          </div>
        )}
        {trimmedJob && !statusLoading && jobStatus && !hasData && (
          <MessageBar messageBarType={MessageBarType.info} styles={{ root: { marginTop: 12 } }}>
            <Text variant="small">No data for this job yet. Upload files below, or click Generate Report to see a message.</Text>
          </MessageBar>
        )}
      </div>

      {/* Upload Data */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Upload Data</h3>
        <Text variant="small" block styles={{ root: { marginBottom: 16 } }}>
          Upload XRF data files for this job. You can upload Units and Common Areas separately. No report is generated until you click Generate Report.
        </Text>
        <Stack tokens={{ childrenGap: 16 }}>
          <div
            className={`${styles.dropZone} ${isDragging ? "dragging" : ""} ${file ? styles.hasFile : ""}`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              validateAndSetFile(e.dataTransfer.files[0]);
            }}
            onClick={() => !file && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={(e) => validateAndSetFile(e.target.files?.[0])}
              style={{ display: "none" }}
              disabled={isProcessing}
            />
            <Icon iconName={getFileIcon()} style={{ fontSize: 48, color: "#605e5c", marginBottom: 12, display: "block" }} />
            {file ? (
              <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>{file.name}</Text>
            ) : (
              <>
                <Text variant="medium" block>Drag & drop or click to browse</Text>
                <Text variant="small" styles={{ root: { color: "#605e5c" } }}>.xlsx and .csv</Text>
              </>
            )}
          </div>
          <Dropdown
            label="Area Type"
            selectedKey={areaType}
            options={areaTypeOptions}
            onChange={(_, opt) => setAreaType((opt?.key as "Units" | "Common Areas") || "Units")}
            disabled={isProcessing}
            className={styles.field}
          />
          <PrimaryButton
            text={isUploading ? "Uploading…" : "Upload & Save"}
            onClick={handleUpload}
            disabled={!file || !trimmedJob || isProcessing}
            iconProps={{ iconName: "CloudUpload" }}
          />
        </Stack>
      </div>

      {error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(undefined)}>
          {error}
        </MessageBar>
      )}
    </Stack>
  );
};
