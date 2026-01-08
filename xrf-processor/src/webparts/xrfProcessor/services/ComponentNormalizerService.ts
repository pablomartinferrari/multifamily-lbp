import { OpenAIService } from "./OpenAIService";
import { SharePointService } from "./SharePointService";
import {
  IComponentNormalization,
  INormalizationProgress,
  NormalizationProgressCallback,
} from "../models/INormalization";
import { IXrfReading } from "../models/IXrfReading";

/**
 * Service for normalizing component names using AI with SharePoint caching
 */
export class ComponentNormalizerService {
  private openAIService: OpenAIService;
  private sharePointService: SharePointService;

  constructor(openAIService: OpenAIService, sharePointService: SharePointService) {
    this.openAIService = openAIService;
    this.sharePointService = sharePointService;
  }

  /**
   * Normalize component names from readings
   * Checks cache first, then calls AI for uncached names
   * @param readings - XRF readings with component names to normalize
   * @param onProgress - Optional progress callback
   * @returns Updated readings with normalizedComponent set
   */
  async normalizeReadings(
    readings: IXrfReading[],
    onProgress?: NormalizationProgressCallback
  ): Promise<{ readings: IXrfReading[]; aiNormalizationsCount: number }> {
    // Get unique component names
    const uniqueNames = this.getUniqueComponentNames(readings);

    if (uniqueNames.length === 0) {
      return { readings, aiNormalizationsCount: 0 };
    }

    // Get normalizations
    const normalizations = await this.normalizeComponents(uniqueNames, onProgress);

    // Build lookup map
    const normalizationMap = new Map<string, string>();
    for (const norm of normalizations) {
      normalizationMap.set(norm.originalName.toLowerCase(), norm.normalizedName);
    }

    // Apply normalizations to readings
    const updatedReadings = readings.map((reading) => ({
      ...reading,
      normalizedComponent:
        normalizationMap.get(reading.component.toLowerCase()) || reading.component,
    }));

    // Count AI normalizations
    const aiCount = normalizations.filter((n) => n.source === "AI").length;

    return { readings: updatedReadings, aiNormalizationsCount: aiCount };
  }

  /**
   * Normalize a list of component names
   * @param componentNames - Array of component names
   * @param onProgress - Optional progress callback
   */
  async normalizeComponents(
    componentNames: string[],
    onProgress?: NormalizationProgressCallback
  ): Promise<IComponentNormalization[]> {
    const uniqueNames = Array.from(
      new Set(componentNames.map((n) => n.toLowerCase().trim()))
    ).filter((n) => n.length > 0);

    if (uniqueNames.length === 0) {
      return [];
    }

    const results: IComponentNormalization[] = [];

    // Step 1: Check cache
    this.reportProgress(onProgress, "checking-cache", 0, uniqueNames.length);

    const cachedMappings = await this.sharePointService.getCachedMappings(uniqueNames);
    const uncachedNames: string[] = [];

    for (const name of uniqueNames) {
      const cached = cachedMappings.get(name);
      if (cached) {
        results.push({
          originalName: name,
          normalizedName: cached.NormalizedName,
          confidence: cached.Confidence,
          source: "CACHE",
        });
      } else {
        uncachedNames.push(name);
      }
    }

    this.reportProgress(
      onProgress,
      "checking-cache",
      results.length,
      uniqueNames.length,
      `Found ${results.length} cached mappings`
    );

    // Step 2: Call AI for uncached names
    if (uncachedNames.length > 0) {
      this.reportProgress(
        onProgress,
        "calling-ai",
        results.length,
        uniqueNames.length,
        `Normalizing ${uncachedNames.length} new components...`
      );

      try {
        const aiResult = await this.openAIService.normalizeComponents(uncachedNames);

        // Process AI results
        const processedNames = new Set<string>();

        for (const group of aiResult.normalizations) {
          for (const variant of group.variants) {
            const normalizedVariant = variant.toLowerCase().trim();
            if (uncachedNames.includes(normalizedVariant) && !processedNames.has(normalizedVariant)) {
              results.push({
                originalName: normalizedVariant,
                normalizedName: group.canonical,
                confidence: group.confidence,
                source: "AI",
              });
              processedNames.add(normalizedVariant);
            }
          }
        }

        // Handle any names AI didn't explicitly group (use as-is with title case)
        for (const name of uncachedNames) {
          if (!processedNames.has(name)) {
            results.push({
              originalName: name,
              normalizedName: this.toTitleCase(name),
              confidence: 1.0,
              source: "AI",
            });
          }
        }
      } catch (error) {
        console.error("AI normalization failed:", error);
        // Fall back to title case for uncached names
        for (const name of uncachedNames) {
          results.push({
            originalName: name,
            normalizedName: this.toTitleCase(name),
            confidence: 0.5,
            source: "AI",
          });
        }
      }
    }

    // Step 3: Save new normalizations to cache
    const newNormalizations = results.filter((n) => n.source === "AI");
    if (newNormalizations.length > 0) {
      this.reportProgress(
        onProgress,
        "saving-cache",
        results.length,
        uniqueNames.length,
        `Caching ${newNormalizations.length} new mappings...`
      );

      try {
        await this.saveNormalizationsToCache(newNormalizations);
      } catch (error) {
        console.error("Failed to save normalizations to cache:", error);
        // Non-fatal - continue without caching
      }
    }

    this.reportProgress(
      onProgress,
      "complete",
      uniqueNames.length,
      uniqueNames.length,
      `Normalized ${uniqueNames.length} components`
    );

    return results;
  }

  /**
   * Save AI normalizations to SharePoint cache
   */
  async saveNormalizationsToCache(
    normalizations: IComponentNormalization[]
  ): Promise<void> {
    const mappings = normalizations
      .filter((n) => n.source === "AI")
      .map((n) => ({
        originalName: n.originalName,
        normalizedName: n.normalizedName,
        confidence: n.confidence,
        source: "AI" as const,
      }));

    if (mappings.length > 0) {
      await this.sharePointService.updateComponentCache(mappings);
    }
  }

  /**
   * Get unique component names from readings
   */
  private getUniqueComponentNames(readings: IXrfReading[]): string[] {
    const names = new Set<string>();
    for (const reading of readings) {
      const name = reading.component.toLowerCase().trim();
      if (name) {
        names.add(name);
      }
    }
    return Array.from(names);
  }

  /**
   * Convert string to Title Case
   */
  private toTitleCase(str: string): string {
    return str
      .toLowerCase()
      .split(/[\s\-_]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Report progress if callback provided
   */
  private reportProgress(
    callback: NormalizationProgressCallback | undefined,
    stage: INormalizationProgress["stage"],
    processed: number,
    total: number,
    message?: string
  ): void {
    if (callback) {
      callback({
        stage,
        processed,
        total,
        message: message || `${stage}: ${processed}/${total}`,
      });
    }
  }
}

// ============================================
// Factory Function
// ============================================

import { getOpenAIService } from "./OpenAIService";
import { getSharePointService } from "./ServiceFactory";

let normalizerInstance: ComponentNormalizerService | undefined;

export function getComponentNormalizerService(): ComponentNormalizerService {
  if (!normalizerInstance) {
    normalizerInstance = new ComponentNormalizerService(
      getOpenAIService(),
      getSharePointService()
    );
  }
  return normalizerInstance;
}
