import * as React from "react";
import {
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  SelectionMode,
  Text,
  PrimaryButton,
  DefaultButton,
  SearchBox,
  Dropdown,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  mergeStyleSets,
  IDetailsListStyles,
} from "@fluentui/react";
import * as XLSX from "xlsx";
import { IXrfReading } from "../../models/IXrfReading";

const styles = mergeStyleSets({
  container: {
    padding: "16px",
  },
  header: {
    marginBottom: "16px",
  },
  toolbar: {
    display: "flex",
    gap: "12px",
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
  gridContainer: {
    maxHeight: "500px",
    overflow: "auto",
  },
  exportInfo: {
    marginTop: "16px",
    fontSize: "12px",
    color: "#605e5c",
  },
});

const listStyles: Partial<IDetailsListStyles> = {
  headerWrapper: {
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
};

export interface IAllShotsReportProps {
  /** All readings to display */
  readings: IXrfReading[];
  /** Area type for the report title */
  areaType: "Units" | "Common Areas";
  /** Job number for export filename */
  jobNumber: string;
  /** Callback when user wants to go back */
  onBack?: () => void;
}

export const AllShotsReport: React.FC<IAllShotsReportProps> = ({
  readings,
  areaType,
  jobNumber,
  onBack,
}) => {
  // State
  const [searchText, setSearchText] = React.useState<string>("");
  const [filterResult, setFilterResult] = React.useState<string>("all");
  const [filterSide, setFilterSide] = React.useState<string>("all");

  // Get unique sides for filter dropdown
  const uniqueSides = React.useMemo(() => {
    const sides = new Set<string>();
    readings.forEach((r) => {
      if (r.side) sides.add(r.side);
    });
    return Array.from(sides).sort();
  }, [readings]);

  // Filter readings
  const filteredReadings = React.useMemo(() => {
    let result = readings;

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          r.readingId.toLowerCase().includes(search) ||
          r.component.toLowerCase().includes(search) ||
          r.normalizedComponent?.toLowerCase().includes(search) ||
          r.location?.toLowerCase().includes(search) ||
          r.unitNumber?.toLowerCase().includes(search) ||
          r.roomType?.toLowerCase().includes(search) ||
          r.roomNumber?.toLowerCase().includes(search)
      );
    }

    // Result filter (positive/negative)
    if (filterResult === "positive") {
      result = result.filter((r) => r.isPositive);
    } else if (filterResult === "negative") {
      result = result.filter((r) => !r.isPositive);
    }

    // Side filter
    if (filterSide !== "all") {
      result = result.filter((r) => r.side === filterSide);
    }

    return result;
  }, [readings, searchText, filterResult, filterSide]);

  // Stats
  const stats = React.useMemo(() => {
    const total = readings.length;
    const positive = readings.filter((r) => r.isPositive).length;
    const filtered = filteredReadings.length;
    return { total, positive, filtered };
  }, [readings, filteredReadings]);

  // Column definitions matching the required report format
  const columns: IColumn[] = [
    {
      key: "readingId",
      name: "Reading #",
      fieldName: "readingId",
      minWidth: 70,
      maxWidth: 90,
      isResizable: true,
    },
    {
      key: "component",
      name: "Component (Substrate)",
      fieldName: "normalizedComponent",
      minWidth: 160,
      maxWidth: 220,
      isResizable: true,
      onRender: (item: IXrfReading) => {
        const component = item.normalizedComponent || item.component;
        const substrate = item.normalizedSubstrate || item.substrate;
        const display = substrate ? `${component} (${substrate})` : component;
        return (
          <span title={`${item.component}${item.substrate ? ` on ${item.substrate}` : ''}`}>
            {display}
          </span>
        );
      },
    },
    {
      key: "unitNumber",
      name: "Unit #",
      fieldName: "unitNumber",
      minWidth: 60,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: IXrfReading) => item.unitNumber || "-",
    },
    {
      key: "roomType",
      name: "Room Type",
      fieldName: "roomType",
      minWidth: 90,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: IXrfReading) => item.roomType || "-",
    },
    {
      key: "roomNumber",
      name: "Room #",
      fieldName: "roomNumber",
      minWidth: 60,
      maxWidth: 80,
      isResizable: true,
      onRender: (item: IXrfReading) => item.roomNumber || "-",
    },
    {
      key: "side",
      name: "Side",
      fieldName: "side",
      minWidth: 50,
      maxWidth: 70,
      isResizable: true,
      onRender: (item: IXrfReading) => item.side || "-",
    },
    {
      key: "substrate",
      name: "Substrate",
      fieldName: "substrate",
      minWidth: 80,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: IXrfReading) => item.normalizedSubstrate || item.substrate || "-",
    },
    {
      key: "color",
      name: "Color",
      fieldName: "color",
      minWidth: 70,
      maxWidth: 100,
      isResizable: true,
    },
    {
      key: "leadContent",
      name: "PbC (mg/cm²)",
      fieldName: "leadContent",
      minWidth: 90,
      maxWidth: 110,
      isResizable: true,
      onRender: (item: IXrfReading) => (
        <span className={item.isPositive ? styles.positive : styles.negative}>
          {item.leadContent.toFixed(2)}
        </span>
      ),
    },
    {
      key: "result",
      name: "Result",
      fieldName: "isPositive",
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: IXrfReading) => (
        <span className={item.isPositive ? styles.positive : styles.negative}>
          {item.isPositive ? "POSITIVE" : "Negative"}
        </span>
      ),
    },
  ];

  // Export to Excel
  const handleExportExcel = (): void => {
    const exportData = filteredReadings.map((r) => {
      const component = r.normalizedComponent || r.component;
      const substrate = r.normalizedSubstrate || r.substrate;
      return {
        "Reading #": r.readingId,
        "Component (Substrate)": substrate ? `${component} (${substrate})` : component,
        "Component (Raw)": r.component,
        "Substrate (Raw)": r.substrate || "",
        "Unit #": r.unitNumber || "",
        "Room Type": r.roomType || "",
        "Room #": r.roomNumber || "",
        "Side": r.side || "",
        "Color": r.color,
        "PbC (mg/cm²)": r.leadContent,
        "Result": r.isPositive ? "POSITIVE" : "Negative",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "All Shots");

    // Auto-size columns
    const colWidths = [
      { wch: 12 }, // Reading #
      { wch: 25 }, // Component
      { wch: 10 }, // Unit #
      { wch: 15 }, // Room Type
      { wch: 10 }, // Room #
      { wch: 8 },  // Side
      { wch: 15 }, // Substrate
      { wch: 12 }, // Color
      { wch: 14 }, // PbC
      { wch: 12 }, // Result
    ];
    worksheet["!cols"] = colWidths;

    // Generate filename
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `${jobNumber}_${areaType.replace(" ", "-")}_All-Shots_${timestamp}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  // Export to CSV
  const handleExportCSV = (): void => {
    const exportData = filteredReadings.map((r) => {
      const component = r.normalizedComponent || r.component;
      const substrate = r.normalizedSubstrate || r.substrate;
      return {
        "Reading #": r.readingId,
        "Component (Substrate)": substrate ? `${component} (${substrate})` : component,
        "Component (Raw)": r.component,
        "Substrate (Raw)": r.substrate || "",
        "Unit #": r.unitNumber || "",
        "Room Type": r.roomType || "",
        "Room #": r.roomNumber || "",
        "Side": r.side || "",
        "Color": r.color,
        "PbC (mg/cm²)": r.leadContent,
        "Result": r.isPositive ? "POSITIVE" : "Negative",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    // Download CSV
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().split("T")[0];
    link.href = URL.createObjectURL(blob);
    link.download = `${jobNumber}_${areaType.replace(" ", "-")}_All-Shots_${timestamp}.csv`;
    link.click();
  };

  // Filter options
  const resultFilterOptions: IDropdownOption[] = [
    { key: "all", text: "All Results" },
    { key: "positive", text: "Positive Only" },
    { key: "negative", text: "Negative Only" },
  ];

  const sideFilterOptions: IDropdownOption[] = [
    { key: "all", text: "All Sides" },
    ...uniqueSides.map((s) => ({ key: s, text: `Side ${s}` })),
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Text variant="xLarge" block>
          All Shots Report - {areaType}
        </Text>
        <Text variant="small" style={{ color: "#605e5c" }}>
          Job: {jobNumber} | Complete listing of all XRF readings
        </Text>
      </div>

      {/* Stats Bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>Total Readings</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.positive}`}>
            {stats.positive}
          </span>
          <span className={styles.statLabel}>Positive</span>
        </div>
        <div className={styles.statItem}>
          <span className={`${styles.statValue} ${styles.negative}`}>
            {stats.total - stats.positive}
          </span>
          <span className={styles.statLabel}>Negative</span>
        </div>
        {stats.filtered !== stats.total && (
          <div className={styles.statItem}>
            <span className={styles.statValue}>{stats.filtered}</span>
            <span className={styles.statLabel}>Showing (filtered)</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterSection}>
          <SearchBox
            placeholder="Search reading #, component, room..."
            value={searchText}
            onChange={(_, newValue) => setSearchText(newValue || "")}
            styles={{ root: { width: 250 } }}
          />
          <Dropdown
            selectedKey={filterResult}
            options={resultFilterOptions}
            onChange={(_, option) => setFilterResult(option?.key as string || "all")}
            styles={{ root: { width: 140 } }}
          />
          {uniqueSides.length > 0 && (
            <Dropdown
              selectedKey={filterSide}
              options={sideFilterOptions}
              onChange={(_, option) => setFilterSide(option?.key as string || "all")}
              styles={{ root: { width: 120 } }}
            />
          )}
        </div>
        <div className={styles.actionSection}>
          {onBack && (
            <DefaultButton
              text="Back"
              iconProps={{ iconName: "Back" }}
              onClick={onBack}
            />
          )}
          <DefaultButton
            text="Export CSV"
            iconProps={{ iconName: "ExcelDocument" }}
            onClick={handleExportCSV}
          />
          <PrimaryButton
            text="Export Excel"
            iconProps={{ iconName: "ExcelDocument" }}
            onClick={handleExportExcel}
          />
        </div>
      </div>

      {/* Warning if filtered */}
      {stats.filtered !== stats.total && (
        <MessageBar messageBarType={MessageBarType.info} styles={{ root: { marginBottom: 8 } }}>
          Showing {stats.filtered} of {stats.total} readings (filtered). Export will only include visible readings.
        </MessageBar>
      )}

      {/* Data Grid */}
      <div className={styles.gridContainer}>
        <DetailsList
          items={filteredReadings}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          getKey={(item: IXrfReading) => item.readingId}
          setKey="all-shots-grid"
          onShouldVirtualize={() => false}
          styles={listStyles}
        />
      </div>

      {/* Export Info */}
      <div className={styles.exportInfo}>
        <Text variant="small">
          Exports include: Reading #, Component (Substrate), Component (Raw), Substrate (Raw), Unit #, Room Type, Room #, Side, Color, PbC Content, Result
        </Text>
      </div>
    </div>
  );
};

export default AllShotsReport;
