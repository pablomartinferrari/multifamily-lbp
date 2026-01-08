import * as React from "react";
import {
  Stack,
  TextField,
  Dropdown,
  IDropdownOption,
  PrimaryButton,
  MessageBar,
  MessageBarType,
  ProgressIndicator,
  Icon,
  Text,
} from "@fluentui/react";
import styles from "./FileUpload.module.scss";

export interface IFileUploadProps {
  /** Called when user submits the form */
  onSubmit: (file: File, jobNumber: string, areaType: "Units" | "Common Areas") => void;
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

export const FileUpload: React.FC<IFileUploadProps> = ({
  onSubmit,
  isProcessing,
  progress,
  progressMessage,
}) => {
  const [file, setFile] = React.useState<File | undefined>(undefined);
  const [jobNumber, setJobNumber] = React.useState("");
  const [areaType, setAreaType] = React.useState<"Units" | "Common Areas">("Units");
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const getFileIcon = (): string => {
    if (!file) return "Upload";
    return file.name.toLowerCase().endsWith(".csv") ? "TextDocument" : "ExcelDocument";
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
        placeholder="Enter job number (e.g., JOB-2024-001)"
        disabled={isProcessing}
        className={styles.field}
      />

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

      {/* Submit Button */}
      <PrimaryButton
        text={isProcessing ? "Processing..." : "Process File"}
        onClick={handleSubmit}
        disabled={!isFormValid || isProcessing}
        className={styles.submitButton}
        iconProps={{ iconName: isProcessing ? "Sync" : "CloudUpload" }}
      />
    </Stack>
  );
};

export default FileUpload;
