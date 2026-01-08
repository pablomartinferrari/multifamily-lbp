# BB-07: File Upload Component

> **Priority**: 🟢 Medium  
> **Estimated Effort**: 3-4 hours  
> **Dependencies**: BB-01  
> **Status**: ✅ Complete

---

## Objective

Create a user-friendly file upload interface that captures the Excel file, job number, and area type selection.

---

## Prerequisites

- BB-01 completed (SPFx project with Fluent UI)

---

## Tasks

### 1. Create Component

Create `src/webparts/xrfProcessor/components/FileUpload/FileUpload.tsx`:

```typescript
import * as React from "react";
import {
  Stack,
  TextField,
  Dropdown,
  IDropdownOption,
  PrimaryButton,
  Label,
  MessageBar,
  MessageBarType,
  ProgressIndicator,
} from "@fluentui/react";
import styles from "./FileUpload.module.scss";

export interface IFileUploadProps {
  onSubmit: (file: File, jobNumber: string, areaType: "Units" | "Common Areas") => void;
  isProcessing: boolean;
}

const areaTypeOptions: IDropdownOption[] = [
  { key: "Units", text: "Units" },
  { key: "Common Areas", text: "Common Areas" },
];

export const FileUpload: React.FC<IFileUploadProps> = ({ onSubmit, isProcessing }) => {
  const [file, setFile] = React.useState<File | null>(null);
  const [jobNumber, setJobNumber] = React.useState("");
  const [areaType, setAreaType] = React.useState<"Units" | "Common Areas">("Units");
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile: File | undefined) => {
    setError(null);
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".xlsx")) {
      setError("Please select an Excel file (.xlsx)");
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    validateAndSetFile(droppedFile);
  };

  const handleSubmit = () => {
    if (!file || !jobNumber.trim()) {
      setError("Please provide both a file and job number");
      return;
    }
    onSubmit(file, jobNumber.trim(), areaType);
  };

  return (
    <Stack tokens={{ childrenGap: 16 }} className={styles.container}>
      <Label>Upload XRF Data File</Label>

      {/* Drop Zone */}
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ""} ${file ? styles.hasFile : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        {file ? (
          <span>📄 {file.name}</span>
        ) : (
          <span>Drag & drop .xlsx file here or click to browse</span>
        )}
      </div>

      {/* Job Number */}
      <TextField
        label="Job Number"
        required
        value={jobNumber}
        onChange={(_, v) => setJobNumber(v || "")}
        placeholder="Enter job number"
        disabled={isProcessing}
      />

      {/* Area Type */}
      <Dropdown
        label="Area Type"
        required
        selectedKey={areaType}
        options={areaTypeOptions}
        onChange={(_, opt) => setAreaType(opt?.key as "Units" | "Common Areas")}
        disabled={isProcessing}
      />

      {/* Error Message */}
      {error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
          {error}
        </MessageBar>
      )}

      {/* Progress */}
      {isProcessing && <ProgressIndicator label="Processing..." />}

      {/* Submit Button */}
      <PrimaryButton
        text={isProcessing ? "Processing..." : "Process File"}
        onClick={handleSubmit}
        disabled={!file || !jobNumber.trim() || isProcessing}
      />
    </Stack>
  );
};
```

### 2. Create Styles

Create `src/webparts/xrfProcessor/components/FileUpload/FileUpload.module.scss`:

```scss
.container {
  max-width: 500px;
  padding: 20px;
}

.dropZone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #0078d4;
    background-color: #f3f9fd;
  }

  &.dragging {
    border-color: #0078d4;
    background-color: #e6f2fb;
  }

  &.hasFile {
    border-color: #107c10;
    background-color: #f0fff0;
  }
}
```

---

## Acceptance Criteria

- [ ] Can drag & drop or click to select .xlsx file
- [ ] Validates file type (.xlsx only)
- [ ] Job Number field is required
- [ ] Area Type dropdown works
- [ ] Shows processing indicator when submitting
- [ ] Submit button disabled until form is valid

---

## Output Artifacts

```
src/webparts/xrfProcessor/components/FileUpload/
├── FileUpload.tsx
└── FileUpload.module.scss
```

---

## Next Steps

➡️ Proceed to **BB-08: AI Normalization Review Component**



