import * as React from "react";
import {
  Panel,
  PanelType,
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  IconButton,
  TextField,
  MessageBar,
  MessageBarType,
  Separator,
  ProgressIndicator,
  IIconProps,
} from "@fluentui/react";
import { IComponentNormalization } from "../../models/INormalization";
import styles from "./AINormalizationReview.module.scss";

export interface IAINormalizationReviewProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** List of normalizations to review */
  normalizations: IComponentNormalization[];
  /** Called when user approves selected normalizations */
  onApprove: (approved: IComponentNormalization[]) => void;
  /** Called when user cancels the review */
  onCancel: () => void;
  /** Whether normalizations are still loading */
  isLoading?: boolean;
  /** Loading progress message */
  loadingMessage?: string;
}

interface INormalizationState extends IComponentNormalization {
  /** Whether this normalization is accepted */
  isAccepted: boolean;
  /** User-edited normalized name (if different from AI suggestion) */
  editedName?: string;
}

/** Confidence threshold for auto-accepting normalizations */
const HIGH_CONFIDENCE_THRESHOLD = 0.8;

const checkIcon: IIconProps = { iconName: "CheckMark" };
const cancelIcon: IIconProps = { iconName: "Cancel" };

export const AINormalizationReview: React.FC<IAINormalizationReviewProps> = ({
  isOpen,
  normalizations,
  onApprove,
  onCancel,
  isLoading = false,
  loadingMessage = "Processing...",
}) => {
  const [items, setItems] = React.useState<INormalizationState[]>([]);

  // Initialize state when normalizations change
  React.useEffect(() => {
    setItems(
      normalizations.map((n) => ({
        ...n,
        // Auto-accept high confidence and cached items
        isAccepted: n.confidence >= HIGH_CONFIDENCE_THRESHOLD || n.source === "CACHE",
      }))
    );
  }, [normalizations]);

  const handleToggle = (index: number): void => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, isAccepted: !item.isAccepted } : item
      )
    );
  };

  const handleEdit = (index: number, newName: string): void => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, editedName: newName } : item
      )
    );
  };

  const handleApprove = (): void => {
    const approved = items
      .filter((item) => item.isAccepted)
      .map((item) => ({
        originalName: item.originalName,
        normalizedName: item.editedName || item.normalizedName,
        confidence: item.confidence,
        source: item.source,
      }));
    onApprove(approved);
  };

  const acceptAllHighConfidence = (): void => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        isAccepted: item.confidence >= HIGH_CONFIDENCE_THRESHOLD,
      }))
    );
  };

  const acceptAll = (): void => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        isAccepted: true,
      }))
    );
  };

  const rejectAll = (): void => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        isAccepted: false,
      }))
    );
  };

  // Separate items by source
  const aiItems = items.filter((i) => i.source === "AI");
  const cachedItems = items.filter((i) => i.source === "CACHE");
  const manualItems = items.filter((i) => i.source === "MANUAL");

  const acceptedCount = items.filter((i) => i.isAccepted).length;
  const totalCount = items.length;

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return styles.highConfidence;
    if (confidence >= 0.7) return styles.mediumConfidence;
    return styles.lowConfidence;
  };

  const renderNormalizationCard = (
    item: INormalizationState,
    index: number
  ): JSX.Element => {
    const globalIndex = items.findIndex(
      (i) => i.originalName === item.originalName
    );

    return (
      <div
        key={item.originalName}
        className={`${styles.card} ${item.isAccepted ? styles.accepted : styles.rejected}`}
      >
        <Stack
          horizontal
          horizontalAlign="space-between"
          verticalAlign="start"
          tokens={{ childrenGap: 12 }}
        >
          <Stack tokens={{ childrenGap: 8 }} styles={{ root: { flex: 1 } }}>
            {/* Original name */}
            <Text className={styles.originalLabel}>Original:</Text>
            <Text className={styles.originalName}>&quot;{item.originalName}&quot;</Text>

            {/* Arrow and normalized name */}
            <Stack
              horizontal
              verticalAlign="center"
              tokens={{ childrenGap: 8 }}
            >
              <Text className={styles.arrow}>→</Text>
              <TextField
                value={item.editedName ?? item.normalizedName}
                onChange={(_, v) => handleEdit(globalIndex, v || "")}
                styles={{
                  root: { flex: 1, maxWidth: 250 },
                  fieldGroup: {
                    borderColor: item.isAccepted ? "#107c10" : undefined,
                  },
                }}
                disabled={!item.isAccepted}
              />
            </Stack>

            {/* Confidence badge */}
            <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
              <Text className={styles.confidenceLabel}>Confidence:</Text>
              <span className={`${styles.confidenceBadge} ${getConfidenceColor(item.confidence)}`}>
                {Math.round(item.confidence * 100)}%
              </span>
              {item.source === "CACHE" && (
                <span className={styles.cacheBadge}>Cached</span>
              )}
            </Stack>
          </Stack>

          {/* Accept/Reject button */}
          <IconButton
            iconProps={item.isAccepted ? checkIcon : cancelIcon}
            onClick={() => handleToggle(globalIndex)}
            className={item.isAccepted ? styles.acceptBtn : styles.rejectBtn}
            title={item.isAccepted ? "Click to reject" : "Click to accept"}
          />
        </Stack>
      </div>
    );
  };

  const onRenderFooterContent = (): JSX.Element => (
    <Stack horizontal tokens={{ childrenGap: 8 }}>
      <PrimaryButton
        text={`Apply ${acceptedCount} Selected`}
        onClick={handleApprove}
        disabled={acceptedCount === 0 || isLoading}
        iconProps={{ iconName: "CheckMark" }}
      />
      <DefaultButton text="Cancel" onClick={onCancel} disabled={isLoading} />
    </Stack>
  );

  return (
    <Panel
      isOpen={isOpen}
      type={PanelType.medium}
      headerText="AI Component Normalization"
      onDismiss={onCancel}
      onRenderFooterContent={onRenderFooterContent}
      isFooterAtBottom={true}
      closeButtonAriaLabel="Close"
    >
      <Stack tokens={{ childrenGap: 16 }} className={styles.container}>
        {/* Loading state */}
        {isLoading && (
          <Stack tokens={{ childrenGap: 8 }}>
            <ProgressIndicator label={loadingMessage} />
          </Stack>
        )}

        {/* Summary */}
        {!isLoading && items.length > 0 && (
          <>
            <MessageBar messageBarType={MessageBarType.info}>
              <Text>
                {acceptedCount} of {totalCount} normalization(s) selected for
                approval.
              </Text>
            </MessageBar>

            {/* Bulk actions */}
            <Stack
              horizontal
              tokens={{ childrenGap: 8 }}
              horizontalAlign="end"
              wrap
            >
              <DefaultButton
                text="Accept All High Confidence"
                onClick={acceptAllHighConfidence}
                iconProps={{ iconName: "LikeSolid" }}
              />
              <DefaultButton
                text="Accept All"
                onClick={acceptAll}
                iconProps={{ iconName: "CheckList" }}
              />
              <DefaultButton
                text="Reject All"
                onClick={rejectAll}
                iconProps={{ iconName: "Clear" }}
              />
            </Stack>
          </>
        )}

        {/* Cached items section */}
        {cachedItems.length > 0 && (
          <>
            <Separator />
            <Stack tokens={{ childrenGap: 12 }}>
              <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                <Text variant="large" className={styles.sectionTitle}>
                  From Cache ({cachedItems.length})
                </Text>
              </Stack>
              <MessageBar messageBarType={MessageBarType.success}>
                These components were previously normalized and approved.
              </MessageBar>
              {cachedItems.map((item, index) => renderNormalizationCard(item, index))}
            </Stack>
          </>
        )}

        {/* AI suggestions section */}
        {aiItems.length > 0 && (
          <>
            <Separator />
            <Stack tokens={{ childrenGap: 12 }}>
              <Text variant="large" className={styles.sectionTitle}>
                New AI Suggestions ({aiItems.length})
              </Text>
              {aiItems.map((item, index) => renderNormalizationCard(item, index))}
            </Stack>
          </>
        )}

        {/* Manual items section */}
        {manualItems.length > 0 && (
          <>
            <Separator />
            <Stack tokens={{ childrenGap: 12 }}>
              <Text variant="large" className={styles.sectionTitle}>
                Manual Entries ({manualItems.length})
              </Text>
              {manualItems.map((item, index) => renderNormalizationCard(item, index))}
            </Stack>
          </>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <MessageBar messageBarType={MessageBarType.warning}>
            No normalizations to review. All components may already be
            standardized.
          </MessageBar>
        )}
      </Stack>
    </Panel>
  );
};

export default AINormalizationReview;
