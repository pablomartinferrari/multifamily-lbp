import * as React from "react";
import {
  Panel,
  PanelType,
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  TextField,
  MessageBar,
  MessageBarType,
  Separator,
  ProgressIndicator,
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

          {/* Accept / Reject — explicit buttons so it's clear they're clickable */}
          <Stack horizontal tokens={{ childrenGap: 8 }} verticalAlign="center">
            {item.isAccepted ? (
              <PrimaryButton
                text="Accept"
                onClick={() => handleToggle(globalIndex)}
                iconProps={{ iconName: "CheckMark" }}
                title="Currently accepted — click Reject to keep original name"
              />
            ) : (
              <DefaultButton
                text="Accept"
                onClick={() => handleToggle(globalIndex)}
                iconProps={{ iconName: "CheckMark" }}
                styles={{ root: { borderColor: "#107c10", color: "#107c10" } }}
                title="Use this suggested name in the report"
              />
            )}
            {!item.isAccepted ? (
              <DefaultButton
                text="Reject"
                onClick={() => handleToggle(globalIndex)}
                iconProps={{ iconName: "Cancel" }}
                styles={{ root: { borderColor: "#a4262c", color: "#a4262c" } }}
                title="Currently rejected — click Accept to use suggested name"
              />
            ) : (
              <DefaultButton
                text="Reject"
                onClick={() => handleToggle(globalIndex)}
                iconProps={{ iconName: "Cancel" }}
                title="Keep original name instead of suggested"
              />
            )}
          </Stack>
        </Stack>
      </div>
    );
  };

  const onRenderFooterContent = (): JSX.Element => (
    <Stack horizontal tokens={{ childrenGap: 8 }}>
      <PrimaryButton
        text={acceptedCount === 0 ? "Continue without changes" : `Apply ${acceptedCount} selected and continue`}
        onClick={handleApprove}
        disabled={isLoading}
        iconProps={{ iconName: "CheckMark" }}
      />
      <DefaultButton text="Cancel" onClick={onCancel} disabled={isLoading} />
    </Stack>
  );

  return (
    <Panel
      isOpen={isOpen}
      type={PanelType.medium}
      headerText="Component Normalization"
      onDismiss={onCancel}
      onRenderFooterContent={onRenderFooterContent}
      isFooterAtBottom={true}
      closeButtonAriaLabel="Close"
    >
      <Stack tokens={{ childrenGap: 16 }} className={styles.container}>
        {/* Subtitle: what the user is choosing */}
        {!isLoading && (
          <MessageBar messageBarType={MessageBarType.info}>
            <Text block>
              <strong>What you&apos;re reviewing:</strong> Component names (and substrate names) are standardized so the report uses consistent terms. Accept each mapping as-is, edit the suggested name, or reject it to keep the original. Substrate names were also normalized automatically in the background.
            </Text>
          </MessageBar>
        )}

        {/* Loading state */}
        {isLoading && (
          <Stack tokens={{ childrenGap: 8 }}>
            <ProgressIndicator label={loadingMessage} />
          </Stack>
        )}

        {/* Summary */}
        {!isLoading && items.length > 0 && (
          <>
            <Text variant="medium" block className={styles.sectionTitle}>
              Component names — {acceptedCount} of {totalCount} selected
            </Text>
            <Text variant="small" block styles={{ root: { color: "#605e5c", marginBottom: 8 } }}>
              For each row, click <strong>Accept</strong> to use the suggested name in the report, or <strong>Reject</strong> to keep the original. You can edit the suggested name in the text field before accepting.
            </Text>

            {/* Bulk actions: two clear options */}
            <Stack horizontal tokens={{ childrenGap: 8 }} horizontalAlign="end" wrap>
              <DefaultButton
                text="Accept all"
                onClick={acceptAll}
                iconProps={{ iconName: "CheckList" }}
                title="Use every suggested name for the report"
              />
              <DefaultButton
                text="Reject all"
                onClick={rejectAll}
                iconProps={{ iconName: "Clear" }}
                title="Keep all original names"
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
                  Previously approved — Component names ({cachedItems.length})
                </Text>
              </Stack>
              <MessageBar messageBarType={MessageBarType.success}>
                These component names were previously normalized and approved. They will be used as-is unless you change them below.
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
                New AI suggestions — Component names ({aiItems.length})
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
                Manual entries — Component names ({manualItems.length})
              </Text>
              {manualItems.map((item, index) => renderNormalizationCard(item, index))}
            </Stack>
          </>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <MessageBar messageBarType={MessageBarType.warning}>
            No component name mappings to review. All names may already be standardized. You can still continue to the next step.
          </MessageBar>
        )}
      </Stack>
    </Panel>
  );
};

export default AINormalizationReview;
