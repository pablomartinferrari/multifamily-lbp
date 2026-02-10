import { IXrfReading } from "../models/IXrfReading";
import {
  IDatasetSummary,
  IJobSummary,
  IAverageComponentSummary,
  IUniformComponentSummary,
  INonUniformComponentSummary,
  ISummaryStats,
  IClassificationCounts,
  STATISTICAL_SAMPLE_SIZE,
  POSITIVE_PERCENT_THRESHOLD,
} from "../models/ISummary";

/**
 * Service for generating HUD/EPA compliant lead paint summaries
 * Classifies components into Average, Uniform, and Non-Uniform categories
 */
export class SummaryService {
  /**
   * Generate a complete job summary from readings
   * @param jobNumber - Job/project identifier
   * @param sourceFileName - Name of the source Excel file
   * @param commonAreaReadings - Readings from common areas (or undefined)
   * @param unitReadings - Readings from units/apartments (or undefined)
   * @param aiNormalizationsApplied - Count of AI-normalized components
   */
  /** Build an empty dataset summary for a type (used when no readings for that type) */
  private emptyDatasetSummary(datasetType: "COMMON_AREA" | "UNITS"): IDatasetSummary {
    return {
      datasetType,
      totalReadings: 0,
      totalPositive: 0,
      totalNegative: 0,
      uniqueComponents: 0,
      averageComponents: [],
      uniformComponents: [],
      nonUniformComponents: [],
    };
  }

  generateJobSummary(
    jobNumber: string,
    sourceFileName: string,
    commonAreaReadings: IXrfReading[] | undefined,
    unitReadings: IXrfReading[] | undefined,
    aiNormalizationsApplied: number = 0
  ): IJobSummary {
    return {
      jobNumber,
      processedDate: new Date().toISOString(),
      sourceFileName,
      aiNormalizationsApplied,
      commonAreaSummary:
        commonAreaReadings && commonAreaReadings.length > 0
          ? this.classifyDataset(commonAreaReadings, "COMMON_AREA")
          : this.emptyDatasetSummary("COMMON_AREA"),
      unitsSummary:
        unitReadings && unitReadings.length > 0
          ? this.classifyDataset(unitReadings, "UNITS")
          : this.emptyDatasetSummary("UNITS"),
    };
  }

  /**
   * Classify all readings in a dataset into the three summary categories
   * @param readings - Array of XRF readings
   * @param datasetType - Whether this is common area or units data
   */
  classifyDataset(
    readings: IXrfReading[],
    datasetType: "COMMON_AREA" | "UNITS"
  ): IDatasetSummary {
    // Group readings by normalized component + substrate combination
    const groups = this.groupByComponentSubstrate(readings);

    const averageComponents: IAverageComponentSummary[] = [];
    const uniformComponents: IUniformComponentSummary[] = [];
    const nonUniformComponents: INonUniformComponentSummary[] = [];

    for (const group of groups) {
      const classification = this.classifyComponent(group.component, group.substrate, group.readings);

      switch (classification.type) {
        case "AVERAGE":
          averageComponents.push(classification.summary as IAverageComponentSummary);
          break;
        case "UNIFORM":
          uniformComponents.push(classification.summary as IUniformComponentSummary);
          break;
        case "NON_UNIFORM":
          nonUniformComponents.push(
            classification.summary as INonUniformComponentSummary
          );
          break;
      }
    }

    // Sort each category alphabetically by component name, then by substrate
    const sortByComponentSubstrate = (a: { component: string; substrate?: string }, b: { component: string; substrate?: string }): number => {
      const compCompare = a.component.localeCompare(b.component);
      if (compCompare !== 0) return compCompare;
      return (a.substrate || "").localeCompare(b.substrate || "");
    };
    
    averageComponents.sort(sortByComponentSubstrate);
    uniformComponents.sort(sortByComponentSubstrate);
    nonUniformComponents.sort(sortByComponentSubstrate);

    // Calculate totals
    const totalPositive = readings.filter((r) => r.isPositive).length;

    return {
      datasetType,
      totalReadings: readings.length,
      totalPositive,
      totalNegative: readings.length - totalPositive,
      uniqueComponents: groups.length,
      averageComponents,
      uniformComponents,
      nonUniformComponents,
    };
  }

  /**
   * Group readings by component + substrate combination
   * Uses normalizedComponent if available, otherwise uses raw component
   * Uses normalizedSubstrate if available, otherwise uses raw substrate
   * Returns groups with separate component and substrate values for each group
   */
  private groupByComponentSubstrate(
    readings: IXrfReading[]
  ): Array<{ component: string; substrate: string | undefined; readings: IXrfReading[] }> {
    const groupMap: Record<string, { component: string; substrate: string | undefined; readings: IXrfReading[] }> = {};

    for (const reading of readings) {
      // Use normalized component if available, otherwise use raw component
      const component = reading.normalizedComponent || reading.component;
      
      // Use normalized substrate if available, otherwise use raw substrate
      const substrate = reading.normalizedSubstrate || reading.substrate || undefined;
      
      // Create combined key for grouping purposes only
      const groupKey = substrate 
        ? `${component}|||${substrate}`
        : component;

      if (!groupMap[groupKey]) {
        groupMap[groupKey] = { component, substrate, readings: [] };
      }
      groupMap[groupKey].readings.push(reading);
    }

    return Object.values(groupMap);
  }

  /**
   * Classify a single component + substrate combination into one of the three categories
   * Based on HUD/EPA guidelines:
   * - ≥40 readings: Average Components (use 2.5% threshold)
   * - <40 readings, all same: Uniform Components
   * - <40 readings, mixed: Non-Uniform Components
   */
  private classifyComponent(
    component: string,
    substrate: string | undefined,
    readings: IXrfReading[]
  ): {
    type: "AVERAGE" | "UNIFORM" | "NON_UNIFORM";
    summary:
      | IAverageComponentSummary
      | IUniformComponentSummary
      | INonUniformComponentSummary;
  } {
    const total = readings.length;
    const positiveCount = readings.filter((r) => r.isPositive).length;
    const negativeCount = total - positiveCount;
    const positivePct = total > 0 ? (positiveCount / total) * 100 : 0;

    // RULE 1: ≥40 readings → Average Components Summary
    if (total >= STATISTICAL_SAMPLE_SIZE) {
      // POSITIVE if >2.5% positive readings, NEGATIVE otherwise
      const result: "POSITIVE" | "NEGATIVE" =
        positivePct > POSITIVE_PERCENT_THRESHOLD ? "POSITIVE" : "NEGATIVE";

      return {
        type: "AVERAGE",
        summary: {
          component,
          substrate,
          totalReadings: total,
          positiveCount,
          negativeCount,
          positivePercent: this.round(positivePct, 1),
          negativePercent: this.round(100 - positivePct, 1),
          result,
        } as IAverageComponentSummary,
      };
    }

    // RULE 2: <40 readings, ALL same result → Uniform Component Summary
    if (positiveCount === 0 || negativeCount === 0) {
      return {
        type: "UNIFORM",
        summary: {
          component,
          substrate,
          totalReadings: total,
          result: positiveCount > 0 ? "POSITIVE" : "NEGATIVE",
        } as IUniformComponentSummary,
      };
    }

    // RULE 3: <40 readings, MIXED results → Non-Uniform Component Summary
    return {
      type: "NON_UNIFORM",
      summary: {
        component,
        substrate,
        totalReadings: total,
        positiveCount,
        negativeCount,
        positivePercent: this.round(positivePct, 1),
        negativePercent: this.round(100 - positivePct, 1),
        readings: readings,
      } as INonUniformComponentSummary,
    };
  }

  /**
   * Calculate summary statistics for a dataset
   */
  calculateStats(summary: IDatasetSummary): ISummaryStats {
    return {
      totalReadings: summary.totalReadings,
      totalPositive: summary.totalPositive,
      totalNegative: summary.totalNegative,
      positivePercent:
        summary.totalReadings > 0
          ? this.round((summary.totalPositive / summary.totalReadings) * 100, 1)
          : 0,
      uniqueComponents: summary.uniqueComponents,
      averageComponentCount: summary.averageComponents.length,
      uniformComponentCount: summary.uniformComponents.length,
      nonUniformComponentCount: summary.nonUniformComponents.length,
    };
  }

  /**
   * Get classification counts (positive/negative by category)
   */
  getClassificationCounts(summary: IDatasetSummary): IClassificationCounts {
    return {
      averagePositive: summary.averageComponents.filter(
        (c) => c.result === "POSITIVE"
      ).length,
      averageNegative: summary.averageComponents.filter(
        (c) => c.result === "NEGATIVE"
      ).length,
      uniformPositive: summary.uniformComponents.filter(
        (c) => c.result === "POSITIVE"
      ).length,
      uniformNegative: summary.uniformComponents.filter(
        (c) => c.result === "NEGATIVE"
      ).length,
      nonUniformCount: summary.nonUniformComponents.length,
    };
  }

  /**
   * Get all positive components across all categories
   * Returns component names with substrate in parentheses if present
   */
  getAllPositiveComponents(summary: IDatasetSummary): string[] {
    const positives: string[] = [];

    const formatComponentSubstrate = (component: string, substrate?: string): string => {
      return substrate ? `${component} (${substrate})` : component;
    };

    // Average components marked positive
    for (const comp of summary.averageComponents) {
      if (comp.result === "POSITIVE") {
        positives.push(formatComponentSubstrate(comp.component, comp.substrate));
      }
    }

    // Uniform components that are all positive
    for (const comp of summary.uniformComponents) {
      if (comp.result === "POSITIVE") {
        positives.push(formatComponentSubstrate(comp.component, comp.substrate));
      }
    }

    // Non-uniform components with any positive readings
    for (const comp of summary.nonUniformComponents) {
      if (comp.positiveCount > 0) {
        positives.push(formatComponentSubstrate(comp.component, comp.substrate));
      }
    }

    return positives.sort();
  }

  /**
   * Round number to specified decimal places
   */
  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Serialize job summary to JSON string
   */
  toJson(summary: IJobSummary): string {
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Parse job summary from JSON string
   */
  fromJson(json: string): IJobSummary {
    return JSON.parse(json) as IJobSummary;
  }

  /**
   * Generate a filename for the summary JSON
   */
  generateSummaryFileName(jobNumber: string, areaType: "Units" | "Common Areas"): string {
    const dateStr = new Date().toISOString().split("T")[0];
    const areaSlug = areaType === "Units" ? "units" : "common-areas";
    return `${jobNumber}-${areaSlug}-summary-${dateStr}.json`;
  }

  /**
   * Generate filename for combined (Units + Common Areas) summary
   */
  generateCombinedSummaryFileName(jobNumber: string): string {
    const dateStr = new Date().toISOString().split("T")[0];
    return `${jobNumber}-summary-${dateStr}.json`;
  }
}

// ============================================
// Singleton Instance
// ============================================

let summaryServiceInstance: SummaryService | undefined;

export function getSummaryService(): SummaryService {
  if (!summaryServiceInstance) {
    summaryServiceInstance = new SummaryService();
  }
  return summaryServiceInstance;
}
