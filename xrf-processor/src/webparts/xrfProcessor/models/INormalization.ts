/**
 * A group of component names that should be normalized to a single canonical name
 */
export interface INormalizationGroup {
  /** The normalized/canonical name (Title Case) */
  canonical: string;
  /** Original names that map to this canonical name */
  variants: string[];
  /** AI confidence score (0-1) */
  confidence: number;
}

/**
 * Result from AI normalization request
 */
export interface INormalizationResult {
  normalizations: INormalizationGroup[];
}

/**
 * A single component normalization mapping
 */
export interface IComponentNormalization {
  /** Original component name from Excel */
  originalName: string;
  /** Normalized/canonical name */
  normalizedName: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source of the normalization */
  source: "AI" | "CACHE" | "MANUAL";
}

/**
 * A single substrate normalization mapping
 */
export interface ISubstrateNormalization {
  /** Original substrate name from Excel */
  originalName: string;
  /** Normalized/canonical name */
  normalizedName: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source of the normalization */
  source: "AI" | "CACHE" | "MANUAL";
}

/**
 * Progress update during normalization process
 */
export interface INormalizationProgress {
  stage: "checking-cache" | "calling-ai" | "saving-cache" | "complete";
  processed: number;
  total: number;
  message: string;
}

export type NormalizationProgressCallback = (progress: INormalizationProgress) => void;
