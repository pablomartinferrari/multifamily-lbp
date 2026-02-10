import { IXrfReading } from "./IXrfReading";

// ============================================
// CONSTANTS & CLASSIFICATION RULES
// ============================================
//
// Report sections (per data type: Units, Common Areas):
// - Averaged:   Component + substrate with ≥ STATISTICAL_SAMPLE_SIZE readings.
//               Result = POSITIVE if positive % > POSITIVE_PERCENT_THRESHOLD %, else NEGATIVE.
// - Uniform:    Component + substrate with < STATISTICAL_SAMPLE_SIZE readings, all same result.
// - Conflicting (non-uniform): Component + substrate with < STATISTICAL_SAMPLE_SIZE readings,
//               mixed positive/negative; requires location-specific review.
// All three sections are always shown in the report (empty when no shots apply).
//

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
  /** Substrate/surface material (e.g., "Wood", "Metal") */
  substrate?: string;
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
  /** Substrate/surface material (e.g., "Wood", "Metal") */
  substrate?: string;
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
  /** Substrate/surface material (e.g., "Wood", "Metal") */
  substrate?: string;
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
 * Lead paint hazard with remediation options (from Lead Inspector AI)
 */
export interface ILeadPaintHazard {
  /** Human-readable hazard description */
  hazardDescription: string;
  /** Severity: Critical, High, Moderate */
  severity: "Critical" | "High" | "Moderate";
  /** Priority: Restrict Access, ASAP, Schedule */
  priority: "Restrict Access" | "ASAP" | "Schedule";
  /** Abatement option code (e.g., "d", "h") - looked up to full text */
  abateCode: string;
  /** Interim control option code (e.g., "5", "4") - looked up to full text */
  icCode: string;
  /** Full abatement text from Haz reference */
  abatementOptions: string;
  /** Full interim control text from Haz reference */
  interimControlOptions: string;
  /** Source component for this hazard */
  component: string;
  /** Source substrate (if any) */
  substrate?: string;
  /** COMMON_AREA or UNITS */
  areaType: "COMMON_AREA" | "UNITS";
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
  /** Lead paint hazards with remediation options (from Lead Inspector AI) */
  hazards?: ILeadPaintHazard[];
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
