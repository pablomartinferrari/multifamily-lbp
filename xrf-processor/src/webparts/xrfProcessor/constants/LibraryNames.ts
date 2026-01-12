export const LIBRARY_NAMES = {
  SOURCE_FILES: "XRF-SourceFiles",
  PROCESSED_RESULTS: "XRF-ProcessedResults",
  COMPONENT_CACHE: "XRF-ComponentCache",
  SUBSTRATE_CACHE: "XRF-SubstrateCache",
} as const;

export const FIELDS = {
  SOURCE_FILES: {
    JOB_NUMBER: "JobNumber",
    AREA_TYPE: "AreaType",
    PROCESSED_STATUS: "ProcessedStatus",
    PROCESSED_RESULTS_LINK: "ProcessedResultsLink",
  },
  PROCESSED_RESULTS: {
    JOB_NUMBER: "JobNumber",
    AREA_TYPE: "AreaType",
    SOURCE_FILE_LINK: "SourceFileLink",
    TOTAL_READINGS: "TotalReadings",
    UNIQUE_COMPONENTS: "UniqueComponents",
    LEAD_POSITIVE_COUNT: "LeadPositiveCount",
    LEAD_POSITIVE_PERCENT: "LeadPositivePercent",
  },
  COMPONENT_CACHE: {
    NORMALIZED_NAME: "NormalizedName",
    CONFIDENCE: "Confidence",
    SOURCE: "Source",
    USAGE_COUNT: "UsageCount",
    LAST_USED: "LastUsed",
  },
  SUBSTRATE_CACHE: {
    NORMALIZED_NAME: "NormalizedName",
    CONFIDENCE: "Confidence",
    SOURCE: "Source",
    USAGE_COUNT: "UsageCount",
    LAST_USED: "LastUsed",
  },
} as const;

// Processing settings
export const PROCESSING = {
  /** Number of items to process before yielding to UI */
  CHUNK_SIZE: 100,
  /** Delay between chunks to keep UI responsive (ms) */
  CHUNK_DELAY: 10,
  /** Maximum items to fetch from component cache */
  CACHE_FETCH_LIMIT: 5000,
  /** Batch size for SharePoint filter queries */
  FILTER_BATCH_SIZE: 50,
} as const;
