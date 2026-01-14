import * as React from "react";
import {
  Dialog,
  DialogType,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  ChoiceGroup,
  IChoiceGroupOption,
  Text,
  Stack,
  MessageBar,
  MessageBarType,
  Icon,
  mergeStyleSets,
} from "@fluentui/react";

const styles = mergeStyleSets({
  existingInfo: {
    padding: "12px",
    backgroundColor: "#f3f2f1",
    borderRadius: "4px",
    marginBottom: "16px",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  label: {
    color: "#605e5c",
    fontWeight: 400,
  },
  value: {
    fontWeight: 600,
  },
  warningIcon: {
    color: "#d83b01",
    marginRight: "8px",
  },
  optionDescription: {
    marginLeft: "26px",
    color: "#605e5c",
    fontSize: "12px",
  },
  optionLabel: {
    marginLeft: "1.5rem",
  },
});

export type ConflictResolution = "replace" | "merge" | "cancel";

export interface IExistingFileInfo {
  fileName: string;
  uploadDate: string;
  totalReadings: number;
  positiveCount: number;
  status: string;
}

export interface IUploadConflictDialogProps {
  isOpen: boolean;
  jobNumber: string;
  areaType: "Units" | "Common Areas";
  existingFile: IExistingFileInfo;
  newFileName: string;
  onResolve: (resolution: ConflictResolution) => void;
}

export const UploadConflictDialog: React.FC<IUploadConflictDialogProps> = ({
  isOpen,
  jobNumber,
  areaType,
  existingFile,
  newFileName,
  onResolve,
}) => {
  const [selectedOption, setSelectedOption] = React.useState<ConflictResolution>("merge");

  const options: IChoiceGroupOption[] = [
    {
      key: "merge",
      text: "Merge with existing data",
      onRenderLabel: (props) => (
        <Stack className={styles.optionLabel}>
          <Text>{props?.text}</Text>
          <Text className={styles.optionDescription}>
            Combine readings from both files (new readings will be added, duplicates will be updated)
          </Text>
        </Stack>
      ),
    },
    {
      key: "replace",
      text: "Replace existing data",
      onRenderLabel: (props) => (
        <Stack className={styles.optionLabel}>
          <Text>{props?.text}</Text>
          <Text className={styles.optionDescription}>
            Remove all previous readings and use only the new file
          </Text>
        </Stack>
      ),
    },
  ];

  const handleConfirm = (): void => {
    onResolve(selectedOption);
  };

  const handleCancel = (): void => {
    onResolve("cancel");
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={handleCancel}
      dialogContentProps={{
        type: DialogType.largeHeader,
        title: "Existing Data Found",
        subText: `Data already exists for Job ${jobNumber} - ${areaType}`,
      }}
      modalProps={{
        isBlocking: true,
        styles: { main: { minWidth: '600px !important', maxWidth: '800px !important' } },
      }}
    >
      <Stack tokens={{ childrenGap: 16 }}>
        {/* Warning Message */}
        <MessageBar messageBarType={MessageBarType.warning}>
          <Icon iconName="Warning" className={styles.warningIcon} />
          You are uploading a file for a job/area that already has data.
        </MessageBar>

        {/* Existing File Info */}
        <div className={styles.existingInfo}>
          <Text variant="mediumPlus" block style={{ marginBottom: 8 }}>
            <strong>Existing File:</strong>
          </Text>
          <div className={styles.infoRow}>
            <span className={styles.label}>File Name:</span>
            <span className={styles.value}>{existingFile.fileName}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Uploaded:</span>
            <span className={styles.value}>{formatDate(existingFile.uploadDate)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Total Readings:</span>
            <span className={styles.value}>{existingFile.totalReadings}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Positive Results:</span>
            <span className={styles.value} style={{ color: existingFile.positiveCount > 0 ? "#a4262c" : "#107c10" }}>
              {existingFile.positiveCount}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Status:</span>
            <span className={styles.value}>{existingFile.status}</span>
          </div>
        </div>

        {/* New File Info */}
        <div className={styles.existingInfo}>
          <Text variant="mediumPlus" block>
            <strong>New File:</strong> {newFileName}
          </Text>
        </div>

        {/* Resolution Options */}
        <ChoiceGroup
          label="How would you like to handle this?"
          selectedKey={selectedOption}
          options={options}
          onChange={(_, option) => setSelectedOption(option?.key as ConflictResolution)}
        />
      </Stack>

      <DialogFooter>
        <PrimaryButton
          text={selectedOption === "replace" ? "Replace Data" : "Merge Data"}
          onClick={handleConfirm}
          iconProps={{ iconName: selectedOption === "replace" ? "Refresh" : "Merge" }}
        />
        <DefaultButton text="Cancel Upload" onClick={handleCancel} />
      </DialogFooter>
    </Dialog>
  );
};

export default UploadConflictDialog;
