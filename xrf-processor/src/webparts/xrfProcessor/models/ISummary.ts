import { IXrfReading } from "./IXrfReading";

// ============================================
// CONSTANTS
// ============================================

/** Readings needed for statistical (average) sampling method */
export const STATISTICAL_SAMPLE_SIZE = 40;

/** Percentage of positives to classify average component as positive */
export const POSITIVE_PERCENT_THRESHOLD = 2.5;

// ============================================
// SUMMARY TYPES
// ============================================

/**
 * Average Components Summary
 * For components with ≥40 readings (statistical sampling)
 * Uses the 2.5% threshold to determine overall result
 */
export interface IAverageComponentSummary {
  component: string;
  totalReadings: number;
  positiveCount: number;
  negativeCount: number;
  positivePercent: number;
  negativePercent: number;
  /** POSITIVE if >2.5% positive, NEGATIVE if ≤2.5% */
  result: "POSITIVE" | "NEGATIVE";
}

/**
 * Uniform Component Summary
 * For components with <40 readings where ALL readings have the same result
 * (either all positive or all negative)
 */
export interface IUniformComponentSummary {
  component: string;
  totalReadings: number;
  /** POSITIVE if all readings positive, NEGATIVE if all negative */
  result: "POSITIVE" | "NEGATIVE";
}

/**
 * Non-Uniform Component Summary
 * For components with <40 readings with MIXED results (some positive, some negative)
 * Includes individual readings for location-specific reporting
 */
export interface INonUniformComponentSummary {
  component: string;
  totalReadings: number;
  positiveCount: number;
  negativeCount: number;
  positivePercent: number;
  negativePercent: number;
  /** Individual readings for this component (for detailed reporting) */
  readings: IXrfReading[];
}

/**
 * Complete summary for one dataset (Common Area or Units)
 */
export interface IDatasetSummary {
  datasetType: "COMMON_AREA" | "UNITS";
  totalReadings: number;
  totalPositive: number;
  totalNegative: number;
  uniqueComponents: number;
  /** Components with ≥40 readings (statistical sampling) */
  averageComponents: IAverageComponentSummary[];
  /** Components with <40 readings, all same result */
  uniformComponents: IUniformComponentSummary[];
  /** Components with <40 readings, mixed results */
  nonUniformComponents: INonUniformComponentSummary[];
}

/**
 * Complete job summary containing both datasets
 */
export interface IJobSummary {
  jobNumber: string;
  processedDate: string;
  sourceFileName: string;
  /** Count of components that were normalized by AI */
  aiNormalizationsApplied: number;
  /** Summary for common areas (hallways, lobbies, etc.) */
  commonAreaSummary: IDatasetSummary | undefined;
  /** Summary for individual units/apartments */
  unitsSummary: IDatasetSummary | undefined;
}

/**
 * Summary statistics for quick display
 */
export interface ISummaryStats {
  totalReadings: number;
  totalPositive: number;
  totalNegative: number;
  positivePercent: number;
  uniqueComponents: number;
  averageComponentCount: number;
  uniformComponentCount: number;
  nonUniformComponentCount: number;
}

/**
 * Result counts by classification type
 */
export interface IClassificationCounts {
  averagePositive: number;
  averageNegative: number;
  uniformPositive: number;
  uniformNegative: number;
  nonUniformCount: number;
}
