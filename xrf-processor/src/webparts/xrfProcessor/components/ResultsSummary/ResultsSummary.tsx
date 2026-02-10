import * as React from "react";
import {
  Stack,
  Pivot,
  PivotItem,
  DetailsList,
  IColumn,
  SelectionMode,
  Text,
  MessageBar,
  MessageBarType,
  Icon,
  TooltipHost,
  DetailsListLayoutMode,
  PrimaryButton,
} from "@fluentui/react";
import * as XLSX from "xlsx";
import {
  IJobSummary,
  IDatasetSummary,
  IAverageComponentSummary,
  IUniformComponentSummary,
  INonUniformComponentSummary,
  ILeadPaintHazard,
  STATISTICAL_SAMPLE_SIZE,
  POSITIVE_PERCENT_THRESHOLD,
} from "../../models/ISummary";
import { IXrfReading } from "../../models/IXrfReading";
import { AllShotsReport } from "../AllShotsReport";
import styles from "./ResultsSummary.module.scss";

export interface IResultsSummaryProps {
  /** The job summary to display */
  summary: IJobSummary;
  /** Optional callback when user clicks on a non-uniform component to see details */
  onViewReadings?: (component: string, readings: INonUniformComponentSummary) => void;
  /** Optional: All readings for the All Shots report */
  readings?: IXrfReading[];
  /** Optional: Area type being displayed (for All Shots report) */
  areaType?: "Units" | "Common Areas";
}

// Result badge component (defined first to avoid use-before-define)
const ResultBadge: React.FC<{ result: "POSITIVE" | "NEGATIVE" }> = ({ result }) => (
  <span className={result === "POSITIVE" ? styles.positiveBadge : styles.negativeBadge}>
    <Icon iconName={result === "POSITIVE" ? "Warning" : "CheckMark"} className={styles.badgeIcon} />
    {result}
  </span>
);

// Column definitions (defined before components that use them)
function getAverageColumns(): IColumn[] {
  return [
    {
      key: "component",
      name: "Component",
      fieldName: "component",
      minWidth: 140,
      maxWidth: 220,
      isResizable: true,
    },
    {
      key: "substrate",
      name: "Substrate",
      fieldName: "substrate",
      minWidth: 100,
      maxWidth: 140,
      isResizable: true,
      onRender: (item: IAverageComponentSummary) => item.substrate || "—",
    },
    {
      key: "result",
      name: "Result",
      fieldName: "result",
      minWidth: 100,
      maxWidth: 120,
      onRender: (item: IAverageComponentSummary) => <ResultBadge result={item.result} />,
    },
    {
      key: "positivePercent",
      name: "Positive %",
      fieldName: "positivePercent",
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: IAverageComponentSummary) => (
        <span className={styles.percentValue}>{item.positivePercent}%</span>
      ),
    },
    {
      key: "negativePercent",
      name: "Negative %",
      fieldName: "negativePercent",
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: IAverageComponentSummary) => (
        <span className={styles.percentValue}>{item.negativePercent}%</span>
      ),
    },
    {
      key: "positiveCount",
      name: "Pos",
      fieldName: "positiveCount",
      minWidth: 50,
      maxWidth: 60,
    },
    {
      key: "negativeCount",
      name: "Neg",
      fieldName: "negativeCount",
      minWidth: 50,
      maxWidth: 60,
    },
    {
      key: "totalReadings",
      name: "Total",
      fieldName: "totalReadings",
      minWidth: 60,
      maxWidth: 80,
    },
  ];
}

function getUniformColumns(): IColumn[] {
  return [
    {
      key: "component",
      name: "Component",
      fieldName: "component",
      minWidth: 140,
      maxWidth: 220,
      isResizable: true,
    },
    {
      key: "substrate",
      name: "Substrate",
      fieldName: "substrate",
      minWidth: 100,
      maxWidth: 140,
      isResizable: true,
      onRender: (item: IUniformComponentSummary) => item.substrate || "—",
    },
    {
      key: "result",
      name: "Result",
      fieldName: "result",
      minWidth: 100,
      maxWidth: 120,
      onRender: (item: IUniformComponentSummary) => <ResultBadge result={item.result} />,
    },
    {
      key: "totalReadings",
      name: "Total Readings",
      fieldName: "totalReadings",
      minWidth: 100,
      maxWidth: 120,
    },
  ];
}

function getNonUniformColumns(
  onViewReadings?: (component: string, readings: INonUniformComponentSummary) => void
): IColumn[] {
  return [
    {
      key: "component",
      name: "Component",
      fieldName: "component",
      minWidth: 140,
      maxWidth: 220,
      isResizable: true,
    },
    {
      key: "substrate",
      name: "Substrate",
      fieldName: "substrate",
      minWidth: 100,
      maxWidth: 140,
      isResizable: true,
      onRender: (item: INonUniformComponentSummary) => item.substrate || "—",
    },
    {
      key: "positiveCount",
      name: "Positive",
      fieldName: "positiveCount",
      minWidth: 70,
      maxWidth: 90,
      onRender: (item: INonUniformComponentSummary) => (
        <span className={styles.positiveCount}>{item.positiveCount}</span>
      ),
    },
    {
      key: "negativeCount",
      name: "Negative",
      fieldName: "negativeCount",
      minWidth: 70,
      maxWidth: 90,
      onRender: (item: INonUniformComponentSummary) => (
        <span className={styles.negativeCount}>{item.negativeCount}</span>
      ),
    },
    {
      key: "positivePercent",
      name: "Pos %",
      fieldName: "positivePercent",
      minWidth: 60,
      maxWidth: 80,
      onRender: (item: INonUniformComponentSummary) => `${item.positivePercent}%`,
    },
    {
      key: "totalReadings",
      name: "Total",
      fieldName: "totalReadings",
      minWidth: 60,
      maxWidth: 80,
    },
    ...(onViewReadings
      ? [
          {
            key: "actions",
            name: "",
            minWidth: 80,
            maxWidth: 80,
            onRender: (item: INonUniformComponentSummary) => (
              <button
                className={styles.viewButton}
                onClick={() => onViewReadings(item.component, item)}
              >
                View Details
              </button>
            ),
          } as IColumn,
        ]
      : []),
  ];
}

// Classification rules (documented for report consistency)
const CLASSIFICATION_RULES = {
  average: `Averaged: Component + substrate combinations with ≥${STATISTICAL_SAMPLE_SIZE} readings. Result is POSITIVE if positive % > ${POSITIVE_PERCENT_THRESHOLD}%, otherwise NEGATIVE (HUD/EPA statistical sampling).`,
  uniform: `Uniform: Component + substrate with <${STATISTICAL_SAMPLE_SIZE} readings where every reading has the same result (all positive or all negative).`,
  conflicting: `Conflicting (non-uniform): Component + substrate with <${STATISTICAL_SAMPLE_SIZE} readings and mixed positive/negative results. Requires location-specific review.`,
};

// Dataset Summary View (defined before ResultsSummary that uses it)
interface IDatasetSummaryViewProps {
  summary: IDatasetSummary;
  onViewReadings?: (component: string, readings: INonUniformComponentSummary) => void;
}

const DatasetSummaryView: React.FC<IDatasetSummaryViewProps> = ({
  summary,
  onViewReadings,
}) => {
  const positivePercent = summary.totalReadings > 0
    ? Math.round((summary.totalPositive / summary.totalReadings) * 100)
    : 0;

  return (
    <Stack tokens={{ childrenGap: 24 }} className={styles.datasetContainer}>
      {/* Classification rules (documented) */}
      <MessageBar messageBarType={MessageBarType.info}>
        <Stack tokens={{ childrenGap: 4 }}>
          <Text variant="small" block><strong>Classification rules</strong></Text>
          <Text variant="small" block>{CLASSIFICATION_RULES.average}</Text>
          <Text variant="small" block>{CLASSIFICATION_RULES.uniform}</Text>
          <Text variant="small" block>{CLASSIFICATION_RULES.conflicting}</Text>
        </Stack>
      </MessageBar>

      {/* Stats Cards */}
      <Stack horizontal tokens={{ childrenGap: 16 }} wrap className={styles.statsRow}>
        <div className={styles.statCard}>
          <Text className={styles.statValue}>{summary.totalReadings}</Text>
          <Text className={styles.statLabel}>Total Readings</Text>
        </div>
        <div className={`${styles.statCard} ${styles.positiveCard}`}>
          <Text className={styles.statValue}>{summary.totalPositive}</Text>
          <Text className={styles.statLabel}>Positive ({positivePercent}%)</Text>
        </div>
        <div className={`${styles.statCard} ${styles.negativeCard}`}>
          <Text className={styles.statValue}>{summary.totalNegative}</Text>
          <Text className={styles.statLabel}>Negative ({100 - positivePercent}%)</Text>
        </div>
        <div className={styles.statCard}>
          <Text className={styles.statValue}>{summary.uniqueComponents}</Text>
          <Text className={styles.statLabel}>Unique Combinations</Text>
        </div>
      </Stack>

      {/* Averaged: always show section (empty when no shots apply) */}
      <Stack className={styles.section}>
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
          <Icon iconName="BarChart4" className={styles.sectionIcon} />
          <Text variant="large" className={styles.sectionTitle}>
            Averaged
          </Text>
          <TooltipHost content={CLASSIFICATION_RULES.average}>
            <Icon iconName="Info" className={styles.infoIcon} />
          </TooltipHost>
        </Stack>
        <Text className={styles.sectionSubtitle}>
          {summary.averageComponents.length === 0
            ? "No components in this category (need ≥40 readings per component/substrate)"
            : `${summary.averageComponents.length} component(s) with ≥40 readings`}
        </Text>
        {summary.averageComponents.length > 0 ? (
          <DetailsList
            items={summary.averageComponents}
            columns={getAverageColumns()}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
            compact
            className={styles.table}
          />
        ) : (
          <MessageBar messageBarType={MessageBarType.info}>No shots apply.</MessageBar>
        )}
      </Stack>

      {/* Uniform: always show section (empty when no shots apply) */}
      <Stack className={styles.section}>
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
          <Icon iconName="CheckList" className={styles.sectionIcon} />
          <Text variant="large" className={styles.sectionTitle}>
            Uniform
          </Text>
          <TooltipHost content={CLASSIFICATION_RULES.uniform}>
            <Icon iconName="Info" className={styles.infoIcon} />
          </TooltipHost>
        </Stack>
        <Text className={styles.sectionSubtitle}>
          {summary.uniformComponents.length === 0
            ? "No components in this category (<40 readings, all same result)"
            : `${summary.uniformComponents.length} component(s) with consistent results`}
        </Text>
        {summary.uniformComponents.length > 0 ? (
          <DetailsList
            items={summary.uniformComponents}
            columns={getUniformColumns()}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
            compact
            className={styles.table}
          />
        ) : (
          <MessageBar messageBarType={MessageBarType.info}>No shots apply.</MessageBar>
        )}
      </Stack>

      {/* Conflicting (non-uniform): always show section (empty when no shots apply) */}
      <Stack className={styles.section}>
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
          <Icon iconName="Warning" className={styles.sectionIconWarning} />
          <Text variant="large" className={styles.sectionTitle}>
            Conflicting
          </Text>
          <TooltipHost content={CLASSIFICATION_RULES.conflicting}>
            <Icon iconName="Info" className={styles.infoIcon} />
          </TooltipHost>
        </Stack>
        <Text className={styles.sectionSubtitle}>
          {summary.nonUniformComponents.length === 0
            ? "No components in this category (<40 readings, mixed positive/negative)"
            : `${summary.nonUniformComponents.length} component(s) with mixed results`}
        </Text>
        {summary.nonUniformComponents.length > 0 ? (
          <>
            <MessageBar messageBarType={MessageBarType.warning} className={styles.warningBar}>
              These components have mixed positive/negative results and may require location-specific inspection.
            </MessageBar>
            <DetailsList
              items={summary.nonUniformComponents}
              columns={getNonUniformColumns(onViewReadings)}
              selectionMode={SelectionMode.none}
              layoutMode={DetailsListLayoutMode.justified}
              compact
              className={styles.table}
            />
          </>
        ) : (
          <MessageBar messageBarType={MessageBarType.info}>No shots apply.</MessageBar>
        )}
      </Stack>
    </Stack>
  );
};

// Hazards View - Individual lead paint hazards with remediation options
const HazardsView: React.FC<{ hazards: ILeadPaintHazard[] }> = ({ hazards }) => {
  const commonAreaHazards = hazards.filter((h) => h.areaType === "COMMON_AREA");
  const unitHazards = hazards.filter((h) => h.areaType === "UNITS");

  const renderHazardSection = (title: string, list: ILeadPaintHazard[]): React.ReactNode => {
    if (list.length === 0) return null;
    return (
      <Stack className={styles.section} tokens={{ childrenGap: 12 }}>
        <Text variant="large" className={styles.sectionTitle}>
          {title}
        </Text>
        {list.map((h, idx) => (
          <div key={idx} className={styles.hazardCard}>
            <Text block className={styles.hazardDescription}>
              {h.hazardDescription}
            </Text>
            <Stack horizontal tokens={{ childrenGap: 16 }} style={{ marginTop: 8, flexWrap: "wrap" }}>
              <span className={styles.hazardMeta}>
                <strong>Severity:</strong> {h.severity}
              </span>
              <span className={styles.hazardMeta}>
                <strong>Priority:</strong> {h.priority}
              </span>
            </Stack>
            <Stack tokens={{ childrenGap: 4 }} style={{ marginTop: 8 }}>
              <Text variant="small" block>
                <strong>Proposed abatement (from reference):</strong> {h.abatementOptions}
              </Text>
              <Text variant="small" block>
                <strong>Proposed interim control (from reference):</strong> {h.interimControlOptions}
              </Text>
            </Stack>
          </div>
        ))}
      </Stack>
    );
  };

  return (
    <Stack tokens={{ childrenGap: 24 }}>
      {renderHazardSection("Individual Common Area Paint Hazards", commonAreaHazards)}
      {renderHazardSection("Individual Dwelling Unit Paint Hazards", unitHazards)}
    </Stack>
  );
};

// Main ResultsSummary component
export const ResultsSummary: React.FC<IResultsSummaryProps> = ({
  summary,
  onViewReadings,
  readings,
  areaType,
}) => {
  const hasCommonArea = summary.commonAreaSummary && summary.commonAreaSummary.totalReadings > 0;
  const hasUnits = summary.unitsSummary && summary.unitsSummary.totalReadings > 0;
  const hasReadings = readings && readings.length > 0;
  const commonAreaReadings = (readings || []).filter((r) => r.areaType === "Common Areas");
  const unitReadings = (readings || []).filter((r) => r.areaType === "Units" || !r.areaType);

  const addSheetsForDataset = (
    workbook: XLSX.WorkBook,
    datasetSummary: IDatasetSummary,
    prefix: string
  ): void => {
    const addSheet = (data: Record<string, unknown>[], sheetName: string): void => {
      if (data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, ws, sheetName);
      }
    };
    if (datasetSummary.averageComponents.length > 0) {
      addSheet(
        datasetSummary.averageComponents.map(c => ({
          "Component": c.component,
          "Substrate": c.substrate || "",
          "Result": c.result,
          "Positive %": `${c.positivePercent}%`,
          "Negative %": `${c.negativePercent}%`,
          "Pos Count": c.positiveCount,
          "Neg Count": c.negativeCount,
          "Total Readings": c.totalReadings
        })),
        `${prefix} - Average`
      );
    }
    if (datasetSummary.uniformComponents.length > 0) {
      addSheet(
        datasetSummary.uniformComponents.map(c => ({
          "Component": c.component,
          "Substrate": c.substrate || "",
          "Result": c.result,
          "Total Readings": c.totalReadings
        })),
        `${prefix} - Uniform`
      );
    }
    if (datasetSummary.nonUniformComponents.length > 0) {
      addSheet(
        datasetSummary.nonUniformComponents.map(c => ({
          "Component": c.component,
          "Substrate": c.substrate || "",
          "Positive Count": c.positiveCount,
          "Negative Count": c.negativeCount,
          "Positive %": `${c.positivePercent}%`,
          "Total Readings": c.totalReadings
        })),
        `${prefix} - Non-Uniform`
      );
    }
  };

  const handleExportExcel = (): void => {
    const workbook = XLSX.utils.book_new();
    if (hasCommonArea && summary.commonAreaSummary) {
      addSheetsForDataset(workbook, summary.commonAreaSummary, "Common Areas");
    }
    if (hasUnits && summary.unitsSummary) {
      addSheetsForDataset(workbook, summary.unitsSummary, "Units");
    }
    if (summary.hazards && summary.hazards.length > 0) {
      const hazardData = summary.hazards.map((h) => ({
        "Identified Hazard": h.hazardDescription,
        "Severity": h.severity,
        "Priority": h.priority,
        "Proposed Abatement": h.abatementOptions,
        "Proposed Interim Control": h.interimControlOptions,
        "Component": h.component,
        "Substrate": h.substrate || "",
        "Area": h.areaType === "COMMON_AREA" ? "Common Areas" : "Units",
      }));
      const ws = XLSX.utils.json_to_sheet(hazardData);
      XLSX.utils.book_append_sheet(workbook, ws, "Hazards");
    }
    const allShotsRow = (r: IXrfReading): Record<string, unknown> => ({
      "Reading #": (r as { rawRow?: { originalReadingId?: string } }).rawRow?.originalReadingId || r.readingId,
      "Component (Raw)": r.component,
      "Component (Normalized)": r.normalizedComponent || r.component,
      "Substrate (Raw)": r.substrate || "",
      "Substrate (Normalized)": r.normalizedSubstrate || r.substrate || "",
      "Unit #": r.unitNumber || "",
      "Room Type": r.roomType || "",
      "Room #": r.roomNumber || "",
      "Side": r.side || "",
      "Color": r.color,
      "PbC (mg/cm²)": r.leadContent,
      "Result": r.isPositive ? "POSITIVE" : "Negative",
    });
    if (commonAreaReadings.length > 0) {
      const ws = XLSX.utils.json_to_sheet(commonAreaReadings.map(allShotsRow));
      XLSX.utils.book_append_sheet(workbook, ws, "All Shots - Common Areas");
    }
    if (unitReadings.length > 0) {
      const ws = XLSX.utils.json_to_sheet(unitReadings.map(allShotsRow));
      XLSX.utils.book_append_sheet(workbook, ws, "All Shots - Units");
    }
    if (!hasCommonArea && !hasUnits && (!summary.hazards || summary.hazards.length === 0) && !hasReadings) return;
    const filename = `XRF_Summary_${summary.jobNumber}_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <Stack tokens={{ childrenGap: 16 }} className={styles.container}>
      {/* Header */}
      <Stack className={styles.header}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xLarge" className={styles.jobTitle}>
            Job: {summary.jobNumber}
          </Text>
          <PrimaryButton
            text="Export All to Excel"
            iconProps={{ iconName: "ExcelDocument" }}
            onClick={handleExportExcel}
          />
        </Stack>
        <Stack horizontal tokens={{ childrenGap: 16 }} className={styles.metadata}>
          <Text variant="small">
            <Icon iconName="Calendar" className={styles.metaIcon} />
            Processed: {new Date(summary.processedDate).toLocaleString()}
          </Text>
          <Text variant="small">
            <Icon iconName="Document" className={styles.metaIcon} />
            Source: {summary.sourceFileName}
          </Text>
          {summary.aiNormalizationsApplied > 0 && (
            <Text variant="small">
              <Icon iconName="Robot" className={styles.metaIcon} />
              AI Normalizations: {summary.aiNormalizationsApplied}
            </Text>
          )}
        </Stack>
      </Stack>

      {/* Content - always show both Units and Common Areas; each tab has Averaged/Uniform/Conflicting + All Shots */}
      <Pivot className={styles.pivot}>
        <PivotItem
          headerText="Common Areas"
          itemIcon="Home"
          itemCount={summary.commonAreaSummary ? summary.commonAreaSummary.totalReadings : 0}
        >
          <Stack tokens={{ childrenGap: 24 }}>
            <DatasetSummaryView
              summary={summary.commonAreaSummary!}
              onViewReadings={onViewReadings}
            />
            <Stack className={styles.section} tokens={{ childrenGap: 12 }}>
              <Text variant="large" className={styles.sectionTitle}>
                All Shots — Common Areas
              </Text>
              <Text className={styles.sectionSubtitle}>
                {commonAreaReadings.length} reading(s)
              </Text>
              {commonAreaReadings.length > 0 ? (
                <AllShotsReport
                  readings={commonAreaReadings}
                  areaType="Common Areas"
                  jobNumber={summary.jobNumber}
                />
              ) : (
                <MessageBar messageBarType={MessageBarType.info}>
                  No Common Areas shots. Upload data for this type to see readings here.
                </MessageBar>
              )}
            </Stack>
          </Stack>
        </PivotItem>
        <PivotItem
          headerText="Units"
          itemIcon="Org"
          itemCount={summary.unitsSummary ? summary.unitsSummary.totalReadings : 0}
        >
          <Stack tokens={{ childrenGap: 24 }}>
            <DatasetSummaryView
              summary={summary.unitsSummary!}
              onViewReadings={onViewReadings}
            />
            <Stack className={styles.section} tokens={{ childrenGap: 12 }}>
              <Text variant="large" className={styles.sectionTitle}>
                All Shots — Units
              </Text>
              <Text className={styles.sectionSubtitle}>
                {unitReadings.length} reading(s)
              </Text>
              {unitReadings.length > 0 ? (
                <AllShotsReport
                  readings={unitReadings}
                  areaType="Units"
                  jobNumber={summary.jobNumber}
                />
              ) : (
                <MessageBar messageBarType={MessageBarType.info}>
                  No Units shots. Upload data for this type to see readings here.
                </MessageBar>
              )}
            </Stack>
          </Stack>
        </PivotItem>
        {summary.hazards && summary.hazards.length > 0 && (
          <PivotItem
            headerText="Hazards"
            itemIcon="Warning"
            itemCount={summary.hazards.length}
          >
            <HazardsView hazards={summary.hazards} />
          </PivotItem>
        )}
      </Pivot>
    </Stack>
  );
};

export default ResultsSummary;
