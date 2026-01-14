import { SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/files";
import "@pnp/sp/folders";

import { LIBRARY_NAMES, FIELDS, PROCESSING } from "../constants/LibraryNames";
import {
  ISourceFileItem,
  IProcessedResultItem,
  IComponentCacheItem,
  ISubstrateCacheItem,
  ISourceFileMetadata,
  IProcessedResultMetadata,
  IComponentMapping,
  ISubstrateMapping,
} from "../models/SharePointTypes";
import { IXrfReading } from "../models/IXrfReading";
import { IDatasetSummary } from "../models/ISummary";

export class SharePointService {
  private sp: SPFI;

  constructor(sp: SPFI) {
    this.sp = sp;
  }

  // ============================================
  // SOURCE FILES LIBRARY
  // ============================================

  /**
   * Upload an Excel file to the Source Files library
   */
  async uploadSourceFile(
    file: File,
    metadata: ISourceFileMetadata
  ): Promise<{ fileUrl: string; itemId: number }> {
    const library = this.sp.web.lists.getByTitle(LIBRARY_NAMES.SOURCE_FILES);
    const folder = await library.rootFolder();

    // Upload file
    const fileBuffer = await file.arrayBuffer();
    const uploadResult = await this.sp.web
      .getFolderByServerRelativePath(folder.ServerRelativeUrl)
      .files.addUsingPath(file.name, fileBuffer, { Overwrite: true });

    // Get the list item associated with the file
    const fileItem = await this.sp.web
      .getFileByServerRelativePath(uploadResult.ServerRelativeUrl)
      .listItemAllFields();

    // Update metadata
    await library.items.getById(fileItem.Id).update({
      [FIELDS.SOURCE_FILES.JOB_NUMBER]: metadata.jobNumber,
      [FIELDS.SOURCE_FILES.AREA_TYPE]: metadata.areaType,
      [FIELDS.SOURCE_FILES.PROCESSED_STATUS]: "Pending",
    });

    return {
      fileUrl: uploadResult.ServerRelativeUrl,
      itemId: fileItem.Id,
    };
  }

  /**
   * Get file content as ArrayBuffer (for Excel parsing)
   */
  async getFileContent(fileUrl: string): Promise<ArrayBuffer> {
    const file = this.sp.web.getFileByServerRelativePath(fileUrl);
    return await file.getBuffer();
  }

  /**
   * Get the source file for a job/area type and return it as an ArrayBuffer for parsing
   * Returns null if no source file exists
   */
  async getSourceFileForJob(
    jobNumber: string,
    areaType: "Units" | "Common Areas"
  ): Promise<{ buffer: ArrayBuffer; fileName: string; fileUrl: string } | null> {
    const sourceFiles = await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.SOURCE_FILES)
      .items.filter(
        `${FIELDS.SOURCE_FILES.JOB_NUMBER} eq '${this.escapeOData(jobNumber)}' and ${FIELDS.SOURCE_FILES.AREA_TYPE} eq '${areaType}'`
      )
      .select("Id", "Title", "FileRef", "FileLeafRef")
      .orderBy("Created", false)
      .top(1)();

    if (sourceFiles.length === 0 || !sourceFiles[0].FileRef) {
      return null;
    }

    const fileUrl = sourceFiles[0].FileRef;
    const fileName = sourceFiles[0].FileLeafRef || sourceFiles[0].Title || "unknown.xlsx";

    try {
      const buffer = await this.sp.web
        .getFileByServerRelativePath(fileUrl)
        .getBuffer();

      return { buffer, fileName, fileUrl };
    } catch (error) {
      console.error("Failed to get source file content:", error);
      return null;
    }
  }

  /**
   * Update the processing status of a source file
   */
  async updateSourceFileStatus(
    itemId: number,
    status: "Pending" | "Complete" | "Error",
    resultsUrl?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      [FIELDS.SOURCE_FILES.PROCESSED_STATUS]: status,
    };

    if (resultsUrl) {
      updateData[FIELDS.SOURCE_FILES.PROCESSED_RESULTS_LINK] = {
        Url: resultsUrl,
        Description: "View Results",
      };
    }

    await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.SOURCE_FILES)
      .items.getById(itemId)
      .update(updateData);
  }

  /**
   * Get source files by job number
   */
  async getSourceFilesByJob(jobNumber: string): Promise<ISourceFileItem[]> {
    return await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.SOURCE_FILES)
      .items.filter(`${FIELDS.SOURCE_FILES.JOB_NUMBER} eq '${this.escapeOData(jobNumber)}'`)
      .select(
        "Id",
        "Title",
        "JobNumber",
        "AreaType",
        "ProcessedStatus",
        "ProcessedResultsLink",
        "Created",
        "Modified"
      )();
  }

  /**
   * Get all source files with optional status filter
   */
  async getSourceFiles(status?: "Pending" | "Complete" | "Error"): Promise<ISourceFileItem[]> {
    let query = this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.SOURCE_FILES)
      .items.select(
        "Id",
        "Title",
        "JobNumber",
        "AreaType",
        "ProcessedStatus",
        "ProcessedResultsLink",
        "Created",
        "Modified"
      );

    if (status) {
      query = query.filter(`${FIELDS.SOURCE_FILES.PROCESSED_STATUS} eq '${status}'`);
    }

    return await query.top(500)();
  }

  // ============================================
  // PROCESSED RESULTS LIBRARY
  // ============================================

  /**
   * Save processed results (JSON summary) to the library
   */
  async saveProcessedResults(
    summaryJson: string,
    fileName: string,
    metadata: IProcessedResultMetadata
  ): Promise<{ fileUrl: string; itemId: number }> {
    const library = this.sp.web.lists.getByTitle(LIBRARY_NAMES.PROCESSED_RESULTS);
    const folder = await library.rootFolder();

    // Upload JSON file
    const encoder = new TextEncoder();
    const fileBuffer = encoder.encode(summaryJson);

    const uploadResult = await this.sp.web
      .getFolderByServerRelativePath(folder.ServerRelativeUrl)
      .files.addUsingPath(fileName, fileBuffer, { Overwrite: true });

    // Get the list item
    const fileItem = await this.sp.web
      .getFileByServerRelativePath(uploadResult.ServerRelativeUrl)
      .listItemAllFields();

    // Update metadata
    await library.items.getById(fileItem.Id).update({
      [FIELDS.PROCESSED_RESULTS.JOB_NUMBER]: metadata.jobNumber,
      [FIELDS.PROCESSED_RESULTS.AREA_TYPE]: metadata.areaType,
      [FIELDS.PROCESSED_RESULTS.SOURCE_FILE_LINK]: {
        Url: metadata.sourceFileUrl,
        Description: "Source File",
      },
      [FIELDS.PROCESSED_RESULTS.TOTAL_READINGS]: metadata.totalReadings,
      [FIELDS.PROCESSED_RESULTS.UNIQUE_COMPONENTS]: metadata.uniqueComponents,
      [FIELDS.PROCESSED_RESULTS.LEAD_POSITIVE_COUNT]: metadata.leadPositiveCount,
      [FIELDS.PROCESSED_RESULTS.LEAD_POSITIVE_PERCENT]: metadata.leadPositivePercent,
    });

    return {
      fileUrl: uploadResult.ServerRelativeUrl,
      itemId: fileItem.Id,
    };
  }

  /**
   * Get processed results by job number
   */
  async getProcessedResultsByJob(jobNumber: string): Promise<IProcessedResultItem[]> {
    return await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.PROCESSED_RESULTS)
      .items.filter(`${FIELDS.PROCESSED_RESULTS.JOB_NUMBER} eq '${this.escapeOData(jobNumber)}'`)
      .select(
        "Id",
        "Title",
        "JobNumber",
        "AreaType",
        "SourceFileLink",
        "TotalReadings",
        "UniqueComponents",
        "LeadPositiveCount",
        "LeadPositivePercent",
        "Created"
      )();
  }

  /**
   * Get processed result JSON content
   */
  async getProcessedResultContent(fileUrl: string): Promise<string> {
    const file = this.sp.web.getFileByServerRelativePath(fileUrl);
    return await file.getText();
  }

  // ============================================
  // COMPONENT CACHE LIST
  // ============================================

  /**
   * Get all cached component mappings
   */
  async getComponentCache(): Promise<IComponentCacheItem[]> {
    return await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.COMPONENT_CACHE)
      .items.select("Id", "Title", "NormalizedName", "Confidence", "Source", "UsageCount", "LastUsed")
      .top(PROCESSING.CACHE_FETCH_LIMIT)();
  }

  /**
   * Get cached mappings for specific component names
   * Returns a Map for O(1) lookups
   */
  async getCachedMappings(componentNames: string[]): Promise<Map<string, IComponentCacheItem>> {
    const cache = new Map<string, IComponentCacheItem>();

    if (componentNames.length === 0) return cache;

    // Deduplicate and normalize
    const uniqueNames = Array.from(new Set(componentNames.map((n) => n.toLowerCase())));

    // Build filter for batch query (SharePoint has URL length limits)
    const batchSize = PROCESSING.FILTER_BATCH_SIZE;

    for (let i = 0; i < uniqueNames.length; i += batchSize) {
      const batch = uniqueNames.slice(i, i + batchSize);
      const filterParts = batch.map((name) => `Title eq '${this.escapeOData(name)}'`);
      const filter = filterParts.join(" or ");

      const items: IComponentCacheItem[] = await this.sp.web.lists
        .getByTitle(LIBRARY_NAMES.COMPONENT_CACHE)
        .items.filter(filter)
        .select("Id", "Title", "NormalizedName", "Confidence", "Source", "UsageCount", "LastUsed")();

      items.forEach((item) => cache.set(item.Title.toLowerCase(), item));
    }

    return cache;
  }

  /**
   * Add or update component mappings in cache
   * Processes in batches to avoid overwhelming SharePoint
   */
  async updateComponentCache(
    mappings: IComponentMapping[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<void> {
    const list = this.sp.web.lists.getByTitle(LIBRARY_NAMES.COMPONENT_CACHE);
    const today = new Date().toISOString();

    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];

      // Check if exists (case-insensitive)
      const existing = await list.items
        .filter(`Title eq '${this.escapeOData(mapping.originalName)}'`)
        .select("Id", "UsageCount")
        .top(1)();

      if (existing.length > 0) {
        // Update existing
        await list.items.getById(existing[0].Id).update({
          [FIELDS.COMPONENT_CACHE.NORMALIZED_NAME]: mapping.normalizedName,
          [FIELDS.COMPONENT_CACHE.CONFIDENCE]: mapping.confidence,
          [FIELDS.COMPONENT_CACHE.SOURCE]: mapping.source,
          [FIELDS.COMPONENT_CACHE.USAGE_COUNT]: (existing[0].UsageCount || 0) + 1,
          [FIELDS.COMPONENT_CACHE.LAST_USED]: today,
        });
      } else {
        // Create new
        await list.items.add({
          Title: mapping.originalName,
          [FIELDS.COMPONENT_CACHE.NORMALIZED_NAME]: mapping.normalizedName,
          [FIELDS.COMPONENT_CACHE.CONFIDENCE]: mapping.confidence,
          [FIELDS.COMPONENT_CACHE.SOURCE]: mapping.source,
          [FIELDS.COMPONENT_CACHE.USAGE_COUNT]: 1,
          [FIELDS.COMPONENT_CACHE.LAST_USED]: today,
        });
      }

      // Report progress
      if (onProgress) {
        onProgress(i + 1, mappings.length);
      }

      // Yield to UI every chunk
      if ((i + 1) % PROCESSING.CHUNK_SIZE === 0) {
        await this.yieldToUI();
      }
    }
  }

  /**
   * Batch add new component mappings (faster for initial population)
   * Processes multiple mappings sequentially but efficiently
   */
  async batchAddComponentMappings(mappings: IComponentMapping[]): Promise<void> {
    const list = this.sp.web.lists.getByTitle(LIBRARY_NAMES.COMPONENT_CACHE);
    const today = new Date().toISOString();

    // Process in chunks to avoid overwhelming SharePoint
    for (const mapping of mappings) {
      await list.items.add({
        Title: mapping.originalName,
        [FIELDS.COMPONENT_CACHE.NORMALIZED_NAME]: mapping.normalizedName,
        [FIELDS.COMPONENT_CACHE.CONFIDENCE]: mapping.confidence,
        [FIELDS.COMPONENT_CACHE.SOURCE]: mapping.source,
        [FIELDS.COMPONENT_CACHE.USAGE_COUNT]: 1,
        [FIELDS.COMPONENT_CACHE.LAST_USED]: today,
      });
    }
  }

  /**
   * Increment usage count for cached mappings
   */
  async incrementCacheUsage(originalNames: string[]): Promise<void> {
    const list = this.sp.web.lists.getByTitle(LIBRARY_NAMES.COMPONENT_CACHE);
    const today = new Date().toISOString();

    for (const name of originalNames) {
      const items = await list.items
        .filter(`Title eq '${this.escapeOData(name)}'`)
        .select("Id", "UsageCount")
        .top(1)();

      if (items.length > 0) {
        await list.items.getById(items[0].Id).update({
          [FIELDS.COMPONENT_CACHE.USAGE_COUNT]: (items[0].UsageCount || 0) + 1,
          [FIELDS.COMPONENT_CACHE.LAST_USED]: today,
        });
      }
    }
  }

  // ============================================
  // SUBSTRATE CACHE LIST
  // ============================================

  /**
   * Get all cached substrate mappings
   */
  async getSubstrateCache(): Promise<ISubstrateCacheItem[]> {
    return await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.SUBSTRATE_CACHE)
      .items.select("Id", "Title", "NormalizedName", "Confidence", "Source", "UsageCount", "LastUsed")
      .top(PROCESSING.CACHE_FETCH_LIMIT)();
  }

  /**
   * Get cached substrate mappings for specific substrate names
   * Returns a Map for O(1) lookups
   */
  async getCachedSubstrateMappings(substrateNames: string[]): Promise<Map<string, ISubstrateCacheItem>> {
    const cache = new Map<string, ISubstrateCacheItem>();

    if (substrateNames.length === 0) return cache;

    // Deduplicate and normalize
    const uniqueNames = Array.from(new Set(substrateNames.map((n) => n.toLowerCase())));

    // Build filter for batch query (SharePoint has URL length limits)
    const batchSize = PROCESSING.FILTER_BATCH_SIZE;

    for (let i = 0; i < uniqueNames.length; i += batchSize) {
      const batch = uniqueNames.slice(i, i + batchSize);
      const filterParts = batch.map((name) => `Title eq '${this.escapeOData(name)}'`);
      const filter = filterParts.join(" or ");

      const items: ISubstrateCacheItem[] = await this.sp.web.lists
        .getByTitle(LIBRARY_NAMES.SUBSTRATE_CACHE)
        .items.filter(filter)
        .select("Id", "Title", "NormalizedName", "Confidence", "Source", "UsageCount", "LastUsed")();

      items.forEach((item) => cache.set(item.Title.toLowerCase(), item));
    }

    return cache;
  }

  /**
   * Add or update substrate mappings in cache
   * Processes in batches to avoid overwhelming SharePoint
   */
  async updateSubstrateCache(
    mappings: ISubstrateMapping[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<void> {
    const list = this.sp.web.lists.getByTitle(LIBRARY_NAMES.SUBSTRATE_CACHE);
    const today = new Date().toISOString();

    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];

      // Check if exists (case-insensitive)
      const existing = await list.items
        .filter(`Title eq '${this.escapeOData(mapping.originalName)}'`)
        .select("Id", "UsageCount")
        .top(1)();

      if (existing.length > 0) {
        // Update existing
        await list.items.getById(existing[0].Id).update({
          [FIELDS.SUBSTRATE_CACHE.NORMALIZED_NAME]: mapping.normalizedName,
          [FIELDS.SUBSTRATE_CACHE.CONFIDENCE]: mapping.confidence,
          [FIELDS.SUBSTRATE_CACHE.SOURCE]: mapping.source,
          [FIELDS.SUBSTRATE_CACHE.USAGE_COUNT]: (existing[0].UsageCount || 0) + 1,
          [FIELDS.SUBSTRATE_CACHE.LAST_USED]: today,
        });
      } else {
        // Create new
        await list.items.add({
          Title: mapping.originalName,
          [FIELDS.SUBSTRATE_CACHE.NORMALIZED_NAME]: mapping.normalizedName,
          [FIELDS.SUBSTRATE_CACHE.CONFIDENCE]: mapping.confidence,
          [FIELDS.SUBSTRATE_CACHE.SOURCE]: mapping.source,
          [FIELDS.SUBSTRATE_CACHE.USAGE_COUNT]: 1,
          [FIELDS.SUBSTRATE_CACHE.LAST_USED]: today,
        });
      }

      // Report progress
      if (onProgress) {
        onProgress(i + 1, mappings.length);
      }

      // Yield to UI every chunk
      if ((i + 1) % PROCESSING.CHUNK_SIZE === 0) {
        await this.yieldToUI();
      }
    }
  }

  /**
   * Batch add new substrate mappings (faster for initial population)
   */
  async batchAddSubstrateMappings(mappings: ISubstrateMapping[]): Promise<void> {
    const list = this.sp.web.lists.getByTitle(LIBRARY_NAMES.SUBSTRATE_CACHE);
    const today = new Date().toISOString();

    for (const mapping of mappings) {
      await list.items.add({
        Title: mapping.originalName,
        [FIELDS.SUBSTRATE_CACHE.NORMALIZED_NAME]: mapping.normalizedName,
        [FIELDS.SUBSTRATE_CACHE.CONFIDENCE]: mapping.confidence,
        [FIELDS.SUBSTRATE_CACHE.SOURCE]: mapping.source,
        [FIELDS.SUBSTRATE_CACHE.USAGE_COUNT]: 1,
        [FIELDS.SUBSTRATE_CACHE.LAST_USED]: today,
      });
    }
  }

  /**
   * Increment usage count for cached substrate mappings
   */
  async incrementSubstrateCacheUsage(originalNames: string[]): Promise<void> {
    const list = this.sp.web.lists.getByTitle(LIBRARY_NAMES.SUBSTRATE_CACHE);
    const today = new Date().toISOString();

    for (const name of originalNames) {
      const items = await list.items
        .filter(`Title eq '${this.escapeOData(name)}'`)
        .select("Id", "UsageCount")
        .top(1)();

      if (items.length > 0) {
        await list.items.getById(items[0].Id).update({
          [FIELDS.SUBSTRATE_CACHE.USAGE_COUNT]: (items[0].UsageCount || 0) + 1,
          [FIELDS.SUBSTRATE_CACHE.LAST_USED]: today,
        });
      }
    }
  }

  // ============================================
  // DATA MANAGEMENT (Check, Delete, Merge)
  // ============================================

  /**
   * Check if data already exists for a job/area type combination
   */
  async checkExistingData(
    jobNumber: string,
    areaType: "Units" | "Common Areas"
  ): Promise<{
    exists: boolean;
    sourceFile?: ISourceFileItem;
    processedResult?: IProcessedResultItem;
  }> {
    // Check for existing source files
    const sourceFiles = await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.SOURCE_FILES)
      .items.filter(
        `${FIELDS.SOURCE_FILES.JOB_NUMBER} eq '${this.escapeOData(jobNumber)}' and ${FIELDS.SOURCE_FILES.AREA_TYPE} eq '${areaType}'`
      )
      .select(
        "Id",
        "Title",
        "JobNumber",
        "AreaType",
        "ProcessedStatus",
        "ProcessedResultsLink",
        "Created",
        "Modified"
      )
      .orderBy("Created", false)
      .top(1)();

    // Check for existing processed results
    const processedResults = await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.PROCESSED_RESULTS)
      .items.filter(
        `${FIELDS.PROCESSED_RESULTS.JOB_NUMBER} eq '${this.escapeOData(jobNumber)}' and ${FIELDS.PROCESSED_RESULTS.AREA_TYPE} eq '${areaType}'`
      )
      .select(
        "Id",
        "Title",
        "JobNumber",
        "AreaType",
        "SourceFileLink",
        "TotalReadings",
        "UniqueComponents",
        "LeadPositiveCount",
        "LeadPositivePercent",
        "Created"
      )
      .orderBy("Created", false)
      .top(1)();

    return {
      exists: sourceFiles.length > 0 || processedResults.length > 0,
      sourceFile: sourceFiles[0],
      processedResult: processedResults[0],
    };
  }

  /**
   * Delete existing data for a job/area type (used before replacing)
   */
  async deleteExistingData(
    jobNumber: string,
    areaType: "Units" | "Common Areas"
  ): Promise<void> {
    // Delete source files
    const sourceFiles = await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.SOURCE_FILES)
      .items.filter(
        `${FIELDS.SOURCE_FILES.JOB_NUMBER} eq '${this.escapeOData(jobNumber)}' and ${FIELDS.SOURCE_FILES.AREA_TYPE} eq '${areaType}'`
      )
      .select("Id", "FileRef")();

    for (const file of sourceFiles) {
      // Delete the file (which also deletes the list item)
      if (file.FileRef) {
        await this.sp.web.getFileByServerRelativePath(file.FileRef).recycle();
      }
    }

    // Delete processed results
    const processedResults = await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.PROCESSED_RESULTS)
      .items.filter(
        `${FIELDS.PROCESSED_RESULTS.JOB_NUMBER} eq '${this.escapeOData(jobNumber)}' and ${FIELDS.PROCESSED_RESULTS.AREA_TYPE} eq '${areaType}'`
      )
      .select("Id", "FileRef")();

    for (const result of processedResults) {
      if (result.FileRef) {
        await this.sp.web.getFileByServerRelativePath(result.FileRef).recycle();
      }
    }
  }

  /**
   * Get existing readings from a processed result JSON file
   * Used for merging with new data
   */
  async getExistingReadings(
    jobNumber: string,
    areaType: "Units" | "Common Areas"
  ): Promise<IXrfReading[]> {
    const processedResults = await this.sp.web.lists
      .getByTitle(LIBRARY_NAMES.PROCESSED_RESULTS)
      .items.filter(
        `${FIELDS.PROCESSED_RESULTS.JOB_NUMBER} eq '${this.escapeOData(jobNumber)}' and ${FIELDS.PROCESSED_RESULTS.AREA_TYPE} eq '${areaType}'`
      )
      .select("Id", "FileRef")
      .orderBy("Created", false)
      .top(1)();

    if (processedResults.length === 0 || !processedResults[0].FileRef) {
      return [];
    }

    try {
      // Get the JSON content
      const jsonContent = await this.sp.web
        .getFileByServerRelativePath(processedResults[0].FileRef)
        .getText();

      const summary = JSON.parse(jsonContent);

      // Extract readings from the summary
      // The summary structure has commonAreasSummary and unitsSummary
      // Each contains component summaries with individual readings
      const readings: IXrfReading[] = [];

      const extractReadingsFromDataset = (dataset: IDatasetSummary | undefined): void => {
        if (!dataset) return;

        // From non-uniform components (they have individual readings)
        dataset.nonUniformComponents?.forEach((comp) => {
          comp.readings?.forEach((r: IXrfReading) => readings.push(r));
        });

        // Note: averageComponents and uniformComponents don't store individual readings
        // They only store aggregated stats. For full readings, we'd need to re-parse
        // the source file or store readings separately.
      };

      extractReadingsFromDataset(summary.commonAreasSummary);
      extractReadingsFromDataset(summary.unitsSummary);

      return readings;
    } catch (error) {
      console.error("Failed to get existing readings:", error);
      return [];
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Escape single quotes for OData filter queries
   */
  private escapeOData(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * Yield control back to the UI to prevent freezing
   */
  private yieldToUI(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, PROCESSING.CHUNK_DELAY));
  }
}
