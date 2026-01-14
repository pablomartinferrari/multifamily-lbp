// ============================================
// SharePoint Library Item Types
// ============================================

export interface ISourceFileItem {
  Id: number;
  Title: string;
  JobNumber: string;
  AreaType: "Units" | "Common Areas";
  ProcessedStatus: "Pending" | "Complete" | "Error";
  ProcessedResultsLink?: {
    Url: string;
    Description: string;
  };
  Created: string;
  Modified: string;
}

export interface IProcessedResultItem {
  Id: number;
  Title: string;
  JobNumber: string;
  AreaType: "Units" | "Common Areas";
  SourceFileLink?: {
    Url: string;
    Description: string;
  };
  TotalReadings: number;
  UniqueComponents: number;
  LeadPositiveCount: number;
  LeadPositivePercent: number;
  Created: string;
}

export interface IComponentCacheItem {
  Id: number;
  Title: string; // Original component name
  NormalizedName: string;
  Confidence: number;
  Source: "AI" | "Manual";
  UsageCount: number;
  LastUsed: string;
}

export interface ISubstrateCacheItem {
  Id: number;
  Title: string; // Original substrate name
  NormalizedName: string;
  Confidence: number;
  Source: "AI" | "Manual";
  UsageCount: number;
  LastUsed: string;
}

// ============================================
// Input Types (for creating/updating)
// ============================================

export interface ISourceFileMetadata {
  jobNumber: string;
  areaType: "Units" | "Common Areas";
}

export interface IProcessedResultMetadata {
  jobNumber: string;
  areaType: "Units" | "Common Areas";
  sourceFileUrl: string;
  totalReadings: number;
  uniqueComponents: number;
  leadPositiveCount: number;
  leadPositivePercent: number;
}

export interface IComponentMapping {
  originalName: string;
  normalizedName: string;
  confidence: number;
  source: "AI" | "Manual";
}

export interface ISubstrateMapping {
  originalName: string;
  normalizedName: string;
  confidence: number;
  source: "AI" | "Manual";
}

// ============================================
// Progress Tracking (for chunked processing)
// ============================================

export interface IProcessingProgress {
  stage: "uploading" | "parsing" | "normalizing" | "saving" | "complete" | "error";
  percent: number;
  message: string;
  currentItem?: string;
}

export type ProgressCallback = (progress: IProcessingProgress) => void;
