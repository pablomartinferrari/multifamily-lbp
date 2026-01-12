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

      {/* Average Components Section */}
      {summary.averageComponents.length > 0 && (
        <Stack className={styles.section}>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Icon iconName="BarChart4" className={styles.sectionIcon} />
            <Text variant="large" className={styles.sectionTitle}>
              Average Components
            </Text>
            <TooltipHost content="Components with 40+ readings use statistical averaging (2.5% threshold)">
              <Icon iconName="Info" className={styles.infoIcon} />
            </TooltipHost>
          </Stack>
          <Text className={styles.sectionSubtitle}>
            {summary.averageComponents.length} component(s) with ≥40 readings
          </Text>
          <DetailsList
            items={summary.averageComponents}
            columns={getAverageColumns()}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
            compact
            className={styles.table}
          />
        </Stack>
      )}

      {/* Uniform Components Section */}
      {summary.uniformComponents.length > 0 && (
        <Stack className={styles.section}>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Icon iconName="CheckList" className={styles.sectionIcon} />
            <Text variant="large" className={styles.sectionTitle}>
              Uniform Components
            </Text>
            <TooltipHost content="Components with <40 readings where all results are the same">
              <Icon iconName="Info" className={styles.infoIcon} />
            </TooltipHost>
          </Stack>
          <Text className={styles.sectionSubtitle}>
            {summary.uniformComponents.length} component(s) with consistent results
          </Text>
          <DetailsList
            items={summary.uniformComponents}
            columns={getUniformColumns()}
            selectionMode={SelectionMode.none}
            layoutMode={DetailsListLayoutMode.justified}
            compact
            className={styles.table}
          />
        </Stack>
      )}

      {/* Non-Uniform Components Section */}
      {summary.nonUniformComponents.length > 0 && (
        <Stack className={styles.section}>
          <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
            <Icon iconName="Warning" className={styles.sectionIconWarning} />
            <Text variant="large" className={styles.sectionTitle}>
              Non-Uniform Components
            </Text>
            <TooltipHost content="Components with <40 readings and mixed results - requires individual review">
              <Icon iconName="Info" className={styles.infoIcon} />
            </TooltipHost>
          </Stack>
          <Text className={styles.sectionSubtitle}>
            {summary.nonUniformComponents.length} component(s) with mixed results
          </Text>
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
        </Stack>
      )}

      {/* Empty state */}
      {summary.averageComponents.length === 0 &&
        summary.uniformComponents.length === 0 &&
        summary.nonUniformComponents.length === 0 && (
          <MessageBar messageBarType={MessageBarType.info}>
            No component summaries available.
          </MessageBar>
        )}
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

  const handleExportExcel = (): void => {
    const workbook = XLSX.utils.book_new();
    const activeSummary = hasUnits ? summary.unitsSummary : summary.commonAreaSummary;
    
    if (!activeSummary) return;

    // 1. Average Components Sheet
    if (activeSummary.averageComponents.length > 0) {
      const avgData = activeSummary.averageComponents.map(c => ({
        "Component": c.component,
        "Substrate": c.substrate || "",
        "Result": c.result,
        "Positive %": `${c.positivePercent}%`,
        "Negative %": `${c.negativePercent}%`,
        "Pos Count": c.positiveCount,
        "Neg Count": c.negativeCount,
        "Total Readings": c.totalReadings
      }));
      const ws = XLSX.utils.json_to_sheet(avgData);
      XLSX.utils.book_append_sheet(workbook, ws, "Average Components");
    }

    // 2. Uniform Components Sheet
    if (activeSummary.uniformComponents.length > 0) {
      const uniData = activeSummary.uniformComponents.map(c => ({
        "Component": c.component,
        "Substrate": c.substrate || "",
        "Result": c.result,
        "Total Readings": c.totalReadings
      }));
      const ws = XLSX.utils.json_to_sheet(uniData);
      XLSX.utils.book_append_sheet(workbook, ws, "Uniform Components");
    }

    // 3. Non-Uniform Components Sheet
    if (activeSummary.nonUniformComponents.length > 0) {
      const nonData = activeSummary.nonUniformComponents.map(c => ({
        "Component": c.component,
        "Substrate": c.substrate || "",
        "Positive Count": c.positiveCount,
        "Negative Count": c.negativeCount,
        "Positive %": `${c.positivePercent}%`,
        "Total Readings": c.totalReadings
      }));
      const ws = XLSX.utils.json_to_sheet(nonData);
      XLSX.utils.book_append_sheet(workbook, ws, "Non-Uniform Components");
    }

    const filename = `XRF_Summary_${summary.jobNumber}_${new Date().toISOString().split('T')[0]}.xlsx`;
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

      {/* Content */}
      {!hasCommonArea && !hasUnits ? (
        <MessageBar messageBarType={MessageBarType.warning}>
          No data available in this summary.
        </MessageBar>
      ) : (
        <Pivot className={styles.pivot}>
          {hasCommonArea && (
            <PivotItem
              headerText="Common Areas"
              itemIcon="Home"
              itemCount={summary.commonAreaSummary!.totalReadings}
            >
              <DatasetSummaryView
                summary={summary.commonAreaSummary!}
                onViewReadings={onViewReadings}
              />
            </PivotItem>
          )}
          {hasUnits && (
            <PivotItem
              headerText="Units"
              itemIcon="Org"
              itemCount={summary.unitsSummary!.totalReadings}
            >
              <DatasetSummaryView
                summary={summary.unitsSummary!}
                onViewReadings={onViewReadings}
              />
            </PivotItem>
          )}
          {/* All Shots Report Tab */}
          {hasReadings && (
            <PivotItem
              headerText="All Shots"
              itemIcon="BulletedList"
              itemCount={readings.length}
            >
              <AllShotsReport
                readings={readings}
                areaType={areaType || (hasCommonArea ? "Common Areas" : "Units")}
                jobNumber={summary.jobNumber}
              />
            </PivotItem>
          )}
        </Pivot>
      )}
    </Stack>
  );
};

export default ResultsSummary;
