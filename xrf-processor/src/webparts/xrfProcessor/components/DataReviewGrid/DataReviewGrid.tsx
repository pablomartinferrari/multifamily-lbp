import * as React from "react";
import {
  DetailsList,
  DetailsListLayoutMode,
  DetailsRow,
  IDetailsRowProps,
  Selection,
  SelectionMode,
  IColumn,
  TextField,
  Text,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  DefaultButton,
  SearchBox,
  Dropdown,
  IDropdownOption,
  Dialog,
  DialogType,
  DialogFooter,
  TooltipHost,
  mergeStyleSets,
} from "@fluentui/react";
import { IXrfReading, LEAD_POSITIVE_THRESHOLD } from "../../models/IXrfReading";

// Styles
const styles = mergeStyleSets({
  container: {
    padding: "16px",
  },
  header: {
    marginBottom: "16px",
  },
  statsBar: {
    display: "flex",
    gap: "24px",
    marginBottom: "16px",
    padding: "12px",
    backgroundColor: "#f3f2f1",
    borderRadius: "4px",
  },
  statItem: {
    display: "flex",
    flexDirection: "column" as const,
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 600,
  },
  statLabel: {
    fontSize: "12px",
    color: "#605e5c",
  },
  positive: {
    color: "#a4262c",
    fontWeight: 600,
  },
  negative: {
    color: "#107c10",
  },
  editCell: {
    padding: "4px",
  },
  editInput: {
    minWidth: "80px",
  },
  toolbar: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    flexWrap: "wrap" as const,
    alignItems: "center",
  },
  filterSection: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flex: 1,
  },
  actionSection: {
    display: "flex",
    gap: "8px",
  },
  changedRow: {
    backgroundColor: "#fff4ce",
  },
  gridContainer: {
    maxHeight: "500px",
    overflow: "auto",
  },
});

export interface IDataReviewGridProps {
  /** Readings to display and edit */
  readings: IXrfReading[];
  /** Callback when readings are updated */
  onReadingsChange: (readings: IXrfReading[]) => void;
  /** Callback to regenerate summaries */
  onRegenerateSummary: () => void;
  /** Callback to go back to upload */
  onCancel: () => void;
  /** Whether summary regeneration is in progress */
  isProcessing?: boolean;
  /** Area type for context */
  areaType: "Units" | "Common Areas";
}

interface IEditingCell {
  readingId: string;
  field: keyof IXrfReading;
}

export const DataReviewGrid: React.FC<IDataReviewGridProps> = ({
  readings,
  onReadingsChange,
  onRegenerateSummary,
  onCancel,
  isProcessing = false,
  areaType,
}) => {
  // State
  const [editingCell, setEditingCell] = React.useState<IEditingCell | undefined>();
  const [editValue, setEditValue] = React.useState<string>("");
  const [searchText, setSearchText] = React.useState<string>("");
  const [filterPositive, setFilterPositive] = React.useState<string>("all");
  const [changedReadingIds, setChangedReadingIds] = React.useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = React.useState<boolean>(false);
  const [selectedItems, setSelectedItems] = React.useState<IXrfReading[]>([]);

  // Selection
  const selection = React.useMemo(
    () =>
      new Selection({
        onSelectionChanged: () => {
          setSelectedItems(selection.getSelection() as IXrfReading[]);
        },
      }),
    []
  );

  // Filter readings
  const filteredReadings = React.useMemo(() => {
    let result = readings;

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          r.component.toLowerCase().includes(search) ||
          r.normalizedComponent?.toLowerCase().includes(search) ||
          r.location?.toLowerCase().includes(search) ||
          r.readingId.toLowerCase().includes(search)
      );
    }

    // Positive/Negative filter
    if (filterPositive === "positive") {
      result = result.filter((r) => r.isPositive);
    } else if (filterPositive === "negative") {
      result = result.filter((r) => !r.isPositive);
    }

    return result;
  }, [readings, searchText, filterPositive]);

  // Stats
  const stats = React.useMemo(() => {
    const total = readings.length;
    const positive = readings.filter((r) => r.isPositive).length;
    const uniqueComponents = new Set(
      readings.map((r) => r.normalizedComponent || r.component)
    ).size;
    const changedCount = changedReadingIds.size;

    return { total, positive, uniqueComponents, changedCount };
  }, [readings, changedReadingIds]);

  // Start editing a cell
  const startEditing = (readingId: string, field: keyof IXrfReading, currentValue: unknown): void => {
    setEditingCell({ readingId, field });
    setEditValue(String(currentValue || ""));
  };

  // Save edited value
  const saveEdit = (): void => {
    if (!editingCell) return;

    const updatedReadings = readings.map((r) => {
      if (r.readingId === editingCell.readingId) {
        const updated = { ...r };

        // Update the field
        if (editingCell.field === "leadContent") {
          const numValue = parseFloat(editValue);
          if (!isNaN(numValue)) {
            updated.leadContent = numValue;
            updated.isPositive = numValue >= LEAD_POSITIVE_THRESHOLD;
          }
        } else {
          (updated as Record<string, unknown>)[editingCell.field] = editValue;
        }

        // Track changed readings
        setChangedReadingIds((prev) => {
          const newSet = new Set(Array.from(prev));
          newSet.add(r.readingId);
          return newSet;
        });

        return updated;
      }
      return r;
    });

    onReadingsChange(updatedReadings);
    setEditingCell(undefined);
    setEditValue("");
  };

  // Cancel editing
  const cancelEdit = (): void => {
    setEditingCell(undefined);
    setEditValue("");
  };

  // Handle key press in edit mode
  const handleKeyPress = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  // Bulk update normalized component for selected items
  const bulkUpdateComponent = (newNormalizedName: string): void => {
    if (selectedItems.length === 0) return;

    const selectedIds = new Set(selectedItems.map((s) => s.readingId));
    const updatedReadings = readings.map((r) => {
      if (selectedIds.has(r.readingId)) {
        setChangedReadingIds((prev) => {
          const newSet = new Set(Array.from(prev));
          newSet.add(r.readingId);
          return newSet;
        });
        return { ...r, normalizedComponent: newNormalizedName };
      }
      return r;
    });

    onReadingsChange(updatedReadings);
    selection.setAllSelected(false);
  };

  // Render editable cell
  const renderEditableCell = (
    item: IXrfReading,
    field: keyof IXrfReading,
    value: unknown
  ): JSX.Element => {
    const isEditing =
      editingCell?.readingId === item.readingId && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className={styles.editCell}>
          <TextField
            value={editValue}
            onChange={(_, newValue) => setEditValue(newValue || "")}
            onKeyDown={handleKeyPress}
            onBlur={saveEdit}
            autoFocus
            className={styles.editInput}
            styles={{ root: { minWidth: field === "leadContent" ? 60 : 100 } }}
          />
        </div>
      );
    }

    return (
      <div
        className={styles.editCell}
        onDoubleClick={() => startEditing(item.readingId, field, value)}
        style={{ cursor: "pointer" }}
      >
        <TooltipHost content="Double-click to edit">
          <span>{String(value || "-")}</span>
        </TooltipHost>
      </div>
    );
  };

  // Column definitions
  const columns: IColumn[] = [
    {
      key: "readingId",
      name: "ID",
      fieldName: "readingId",
      minWidth: 60,
      maxWidth: 80,
      isResizable: true,
    },
    {
      key: "component",
      name: "Component",
      fieldName: "component",
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
    },
    {
      key: "normalizedComponent",
      name: "Normalized",
      fieldName: "normalizedComponent",
      minWidth: 100,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: IXrfReading) =>
        renderEditableCell(item, "normalizedComponent", item.normalizedComponent || item.component),
    },
    {
      key: "unitNumber",
      name: "Unit #",
      fieldName: "unitNumber",
      minWidth: 60,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: IXrfReading) => renderEditableCell(item, "unitNumber", item.unitNumber),
    },
    {
      key: "roomType",
      name: "Room Type",
      fieldName: "roomType",
      minWidth: 80,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: IXrfReading) => renderEditableCell(item, "roomType", item.roomType),
    },
    {
      key: "roomNumber",
      name: "Room #",
      fieldName: "roomNumber",
      minWidth: 60,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: IXrfReading) => renderEditableCell(item, "roomNumber", item.roomNumber),
    },
    {
      key: "side",
      name: "Side",
      fieldName: "side",
      minWidth: 50,
      maxWidth: 70,
      isResizable: true,
      onRender: (item: IXrfReading) => renderEditableCell(item, "side", item.side),
    },
    {
      key: "color",
      name: "Color",
      fieldName: "color",
      minWidth: 70,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: IXrfReading) => renderEditableCell(item, "color", item.color),
    },
    {
      key: "leadContent",
      name: "Pb (mg/cm²)",
      fieldName: "leadContent",
      minWidth: 80,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: IXrfReading) => (
        <div
          className={item.isPositive ? styles.positive : styles.negative}
          onDoubleClick={() => startEditing(item.readingId, "leadContent", item.leadContent)}
          style={{ cursor: "pointer" }}
        >
          <TooltipHost content="Double-click to edit">
            {item.leadContent.toFixed(2)}
          </TooltipHost>
        </div>
      ),
    },
    {
      key: "result",
      name: "Result",
      fieldName: "isPositive",
      minWidth: 70,
      maxWidth: 90,
      onRender: (item: IXrfReading) => (
        <span className={item.isPositive ? styles.positive : styles.negative}>
          {item.isPositive ? "POSITIVE" : "Negative"}
        </span>
      ),
    },
    {
      key: "substrate",
      name: "Substrate",
      fieldName: "substrate",
      minWidth: 80,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: IXrfReading) => renderEditableCell(item, "substrate", item.substrate),
    },
  ];

  // Filter options
  const filterOptions: IDropdownOption[] = [
    { key: "all", text: "All Results" },
    { key: "positive", text: "Positive Only" },
    { key: "negative", text: "Negative Only" },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Text variant="xLarge" block>
          Review & Edit Data - {areaType}
        </Text>
        <Text variant="small" style={{ color: "#605e5c" }}>
          Double-click any cell to edit. Changes are highlighted in yellow.
        </Text>
      </div>

      {/* Stats Bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Total Readings</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.positive}`}>{stats.positive}</span>
          <span className={styles.statLabel}>Positive</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.negative}`}>{stats.total - stats.positive}</span>
          <span className={styles.statLabel}>Negative</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.uniqueComponents}</span>
          <span className={styles.statLabel}>Components</span>
        </div>
        {stats.changedCount > 0 && (
          <div className={styles.statItem}>
            <span className={styles.statValue} style={{ color: "#c19c00" }}>
              {stats.changedCount}
            </span>
            <span className={styles.statLabel}>Modified</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterSection}>
          <SearchBox
            placeholder="Search component, location, ID..."
            value={searchText}
            onChange={(_, newValue) => setSearchText(newValue || "")}
            styles={{ root: { width: 250 } }}
          />
          <Dropdown
            selectedKey={filterPositive}
            options={filterOptions}
            onChange={(_, option) => setFilterPositive(option?.key as string || "all")}
            styles={{ root: { width: 150 } }}
          />
          {selectedItems.length > 0 && (
            <Text variant="small" style={{ color: "#605e5c" }}>
              {selectedItems.length} selected
            </Text>
          )}
        </div>
        <div className={styles.actionSection}>
          {selectedItems.length > 0 && (
            <DefaultButton
              text={`Bulk Edit (${selectedItems.length})`}
              iconProps={{ iconName: "Edit" }}
              onClick={() => {
                const newName = prompt("Enter new normalized component name:");
                if (newName) bulkUpdateComponent(newName);
              }}
            />
          )}
          <DefaultButton text="Cancel" onClick={onCancel} disabled={isProcessing} />
          <PrimaryButton
            text={stats.changedCount > 0 ? `Regenerate Summary (${stats.changedCount} changes)` : "Generate Summary"}
            iconProps={{ iconName: "Refresh" }}
            onClick={() => setShowConfirmDialog(true)}
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Changed rows warning */}
      {stats.changedCount > 0 && (
        <MessageBar messageBarType={MessageBarType.warning} styles={{ root: { marginBottom: 8 } }}>
          You have {stats.changedCount} modified reading(s). Click &quot;Regenerate Summary&quot; to update the
          results.
        </MessageBar>
      )}

      {/* Data Grid */}
      <div className={styles.gridContainer}>
        <DetailsList
          items={filteredReadings}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selection={selection}
          selectionMode={SelectionMode.multiple}
          selectionPreservedOnEmptyClick
          getKey={(item: IXrfReading) => item.readingId}
          onRenderRow={(props?: IDetailsRowProps) => {
            if (!props) return null;
            const item = props.item as IXrfReading;
            const isChanged = changedReadingIds.has(item.readingId);
            return (
              <div className={isChanged ? styles.changedRow : undefined}>
                <DetailsRow {...props} />
              </div>
            );
          }}
        />
      </div>

      {/* Filtered results message */}
      {filteredReadings.length < readings.length && (
        <Text variant="small" style={{ color: "#605e5c", marginTop: 8 }}>
          Showing {filteredReadings.length} of {readings.length} readings
        </Text>
      )}

      {/* Confirm Dialog */}
      <Dialog
        hidden={!showConfirmDialog}
        onDismiss={() => setShowConfirmDialog(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: "Regenerate Summary?",
          subText: stats.changedCount > 0
            ? `You have ${stats.changedCount} modified readings. The summary will be recalculated with your changes.`
            : "Generate the HUD/EPA summary with the current data?",
        }}
      >
        <DialogFooter>
          <PrimaryButton
            text="Generate Summary"
            onClick={() => {
              setShowConfirmDialog(false);
              onRegenerateSummary();
            }}
          />
          <DefaultButton text="Cancel" onClick={() => setShowConfirmDialog(false)} />
        </DialogFooter>
      </Dialog>
    </div>
  );
};

export default DataReviewGrid;
