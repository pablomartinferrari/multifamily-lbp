import * as XLSX from "xlsx";
import { IXrfReading, LEAD_POSITIVE_THRESHOLD } from "../models/IXrfReading";
import {
  DEFAULT_COLUMN_MAPPING,
  IColumnMapping,
  findColumnMatch,
  getUnmappedHeaders,
} from "../config/ExcelColumnMapping";
import { PROCESSING } from "../constants/LibraryNames";
import { AIColumnMapperService, IAIColumnMapping } from "./AIColumnMapperService";

// ============================================
// Result Types
// ============================================

export interface IParseResult {
  success: boolean;
  readings: IXrfReading[];
  errors: IParseError[];
  warnings: string[];
  metadata: IParseMetadata;
}

export interface IParseError {
  row: number;
  column?: string;
  message: string;
  value?: unknown;
}

export interface IParseMetadata {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  sheetName: string;
  detectedColumns: Record<string, string>;
  unmappedColumns: string[];
  /** Whether AI was used to map columns */
  usedAIMapping?: boolean;
  /** AI mapping confidence (if AI was used) */
  aiMappingConfidence?: number;
}

export type ParseProgressCallback = (
  processed: number,
  total: number,
  stage: "reading" | "parsing" | "ai-mapping"
) => void;

/**
 * Options for parsing
 */
export interface IParseOptions {
  /** Use AI to map columns when static mapping fails */
  useAIFallback?: boolean;
  /** Always use AI for column mapping (skip static mapping) */
  alwaysUseAI?: boolean;
}

// ============================================
// Excel/CSV Parser Service
// ============================================

/**
 * Service for parsing XRF data from Excel (.xlsx) or CSV files.
 * Uses SheetJS which auto-detects file format.
 * Supports AI-powered column mapping for unknown XRF machine formats.
 */
export class ExcelParserService {
  private columnMapping: IColumnMapping;
  private aiColumnMapper?: AIColumnMapperService;

  constructor(
    columnMapping: IColumnMapping = DEFAULT_COLUMN_MAPPING,
    aiColumnMapper?: AIColumnMapperService
  ) {
    this.columnMapping = columnMapping;
    this.aiColumnMapper = aiColumnMapper;
  }

  /**
   * Set the AI column mapper service
   */
  setAIColumnMapper(mapper: AIColumnMapperService): void {
    this.aiColumnMapper = mapper;
  }

  /**
   * Parse an Excel or CSV file buffer into XRF readings
   * @param fileBuffer - ArrayBuffer of the file (xlsx or csv)
   * @param onProgress - Optional callback for progress updates
   * @param options - Optional parse options (AI fallback, etc.)
   */
  async parseFile(
    fileBuffer: ArrayBuffer,
    onProgress?: ParseProgressCallback,
    options: IParseOptions = {}
  ): Promise<IParseResult> {
    const errors: IParseError[] = [];
    const warnings: string[] = [];
    const readings: IXrfReading[] = [];
    let usedAIMapping = false;
    let aiMappingConfidence: number | undefined;

    try {
      // Report reading stage
      if (onProgress) onProgress(0, 100, "reading");

      // Read workbook
      const workbook = XLSX.read(fileBuffer, { type: "array" });

      // Get first sheet (or could make configurable)
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          success: false,
          readings: [],
          errors: [{ row: 0, message: "No data found in file" }],
          warnings: [],
          metadata: this.createEmptyMetadata(),
        };
      }

      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON with headers
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        sheet,
        {
          defval: "", // Default value for empty cells
        }
      );

      if (jsonData.length === 0) {
        return {
          success: false,
          readings: [],
          errors: [{ row: 0, message: "No data rows found in worksheet" }],
          warnings: [],
          metadata: this.createEmptyMetadata(sheetName),
        };
      }

      // Get headers from first row
      const headers = Object.keys(jsonData[0]);

      // Detect column mappings (static or AI)
      let detectedColumns: Record<string, string>;
      let unmappedColumns: string[];

      if (options.alwaysUseAI && this.aiColumnMapper?.isConfigured()) {
        // Always use AI mapping
        if (onProgress) onProgress(0, 100, "ai-mapping");
        const aiMapping = await this.useAIColumnMapping(headers, jsonData);
        detectedColumns = this.aiMappingToDetectedColumns(aiMapping);
        unmappedColumns = aiMapping.unmapped;
        usedAIMapping = true;
        aiMappingConfidence = aiMapping.confidence;
        warnings.push(`Used AI to map columns (confidence: ${(aiMapping.confidence * 100).toFixed(0)}%)`);
      } else {
        // Try static mapping first
        detectedColumns = this.detectColumns(headers);
        unmappedColumns = getUnmappedHeaders(headers, this.columnMapping);
        
        if (unmappedColumns.length > 0) {
          warnings.push(`Unmapped columns found: ${unmappedColumns.join(", ")}`);
        }

        // Check if static mapping found all required columns
        const missingRequired = this.validateRequiredColumns(detectedColumns);
        
        // If static mapping failed and AI fallback is enabled
        if (missingRequired.length > 0 && options.useAIFallback && this.aiColumnMapper?.isConfigured()) {
          if (onProgress) onProgress(0, 100, "ai-mapping");
          warnings.push(`Static column mapping incomplete. Using AI to map columns...`);
          
          try {
            const aiMapping = await this.useAIColumnMapping(headers, jsonData);
            detectedColumns = this.aiMappingToDetectedColumns(aiMapping);
            unmappedColumns = aiMapping.unmapped;
            usedAIMapping = true;
            aiMappingConfidence = aiMapping.confidence;
            warnings.push(`AI mapping complete (confidence: ${(aiMapping.confidence * 100).toFixed(0)}%)`);
          } catch (aiError) {
            warnings.push(`AI column mapping failed: ${aiError instanceof Error ? aiError.message : String(aiError)}`);
            // Continue with partial static mapping - will fail validation below
          }
        }
      }

      // Validate required columns (after potential AI mapping)
      const missingRequired = this.validateRequiredColumns(detectedColumns);
      if (missingRequired.length > 0) {
        return {
          success: false,
          readings: [],
          errors: missingRequired.map((col) => ({
            row: 0,
            message: `Required column not found: ${col}. Available columns: ${headers.join(", ")}`,
          })),
          warnings,
          metadata: {
            totalRows: jsonData.length,
            validRows: 0,
            skippedRows: jsonData.length,
            sheetName,
            detectedColumns,
            unmappedColumns,
            usedAIMapping,
            aiMappingConfidence,
          },
        };
      }

      // Report parsing stage
      if (onProgress) onProgress(0, jsonData.length, "parsing");

      // Parse each row with progress updates
      let rowNumber = 2; // Excel rows start at 1, header is row 1
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const parseResult = this.parseRow(row, rowNumber, detectedColumns);

        if (parseResult.reading) {
          readings.push(parseResult.reading);
        }

        if (parseResult.error) {
          errors.push(parseResult.error);
        }

        if (parseResult.warning) {
          warnings.push(parseResult.warning);
        }

        rowNumber++;

        // Report progress and yield to UI periodically
        if ((i + 1) % PROCESSING.CHUNK_SIZE === 0) {
          if (onProgress) onProgress(i + 1, jsonData.length, "parsing");
          await this.yieldToUI();
        }
      }

      // Final progress update
      if (onProgress) onProgress(jsonData.length, jsonData.length, "parsing");

      return {
        success: errors.length === 0,
        readings,
        errors,
        warnings,
        metadata: {
          totalRows: jsonData.length,
          validRows: readings.length,
          skippedRows: jsonData.length - readings.length,
          sheetName,
          detectedColumns,
          unmappedColumns,
          usedAIMapping,
          aiMappingConfidence,
        },
      };
    } catch (error) {
      return {
        success: false,
        readings: [],
        errors: [
          {
            row: 0,
            message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        warnings: [],
        metadata: this.createEmptyMetadata(),
      };
    }
  }

  /**
   * Parse a File object (convenience method)
   */
  async parseFileObject(
    file: File,
    onProgress?: ParseProgressCallback,
    options: IParseOptions = {}
  ): Promise<IParseResult> {
    const buffer = await file.arrayBuffer();
    return this.parseFile(buffer, onProgress, options);
  }

  /**
   * Detect which columns map to which properties
   */
  private detectColumns(headers: string[]): Record<string, string> {
    const detected: Record<string, string> = {};

    // Required fields
    const readingIdCol = findColumnMatch(headers, this.columnMapping.readingId);
    if (readingIdCol) detected.readingId = readingIdCol;

    const componentCol = findColumnMatch(headers, this.columnMapping.component);
    if (componentCol) detected.component = componentCol;

    const colorCol = findColumnMatch(headers, this.columnMapping.color);
    if (colorCol) detected.color = colorCol;

    const leadContentCol = findColumnMatch(
      headers,
      this.columnMapping.leadContent
    );
    if (leadContentCol) detected.leadContent = leadContentCol;

    // Optional fields - Location hierarchy
    const locationCol = findColumnMatch(headers, this.columnMapping.location);
    if (locationCol) detected.location = locationCol;

    const unitNumberCol = findColumnMatch(headers, this.columnMapping.unitNumber);
    if (unitNumberCol) detected.unitNumber = unitNumberCol;

    const roomTypeCol = findColumnMatch(headers, this.columnMapping.roomType);
    if (roomTypeCol) detected.roomType = roomTypeCol;

    const roomNumberCol = findColumnMatch(headers, this.columnMapping.roomNumber);
    if (roomNumberCol) detected.roomNumber = roomNumberCol;

    // Optional fields - Other
    const substrateCol = findColumnMatch(headers, this.columnMapping.substrate);
    if (substrateCol) detected.substrate = substrateCol;

    const sideCol = findColumnMatch(headers, this.columnMapping.side);
    if (sideCol) detected.side = sideCol;

    const conditionCol = findColumnMatch(headers, this.columnMapping.condition);
    if (conditionCol) detected.condition = conditionCol;

    const timestampCol = findColumnMatch(headers, this.columnMapping.timestamp);
    if (timestampCol) detected.timestamp = timestampCol;

    return detected;
  }

  /**
   * Validate that all required columns were detected
   */
  private validateRequiredColumns(
    detectedColumns: Record<string, string>
  ): string[] {
    const required = ["readingId", "component", "color", "leadContent"];
    return required.filter((col) => !detectedColumns[col]);
  }

  /**
   * Parse a single row into an IXrfReading
   */
  private parseRow(
    row: Record<string, unknown>,
    rowNumber: number,
    columns: Record<string, string>
  ): { reading?: IXrfReading; error?: IParseError; warning?: string } {
    try {
      // Extract required fields
      const readingId = String(row[columns.readingId] || "").trim();
      const component = String(row[columns.component] || "").trim();
      const color = String(row[columns.color] || "").trim();
      const leadContentRaw = row[columns.leadContent];

      // Validate required fields
      if (!readingId) {
        return {
          error: {
            row: rowNumber,
            column: columns.readingId,
            message: "Missing reading ID",
          },
        };
      }
      if (!component) {
        return {
          error: {
            row: rowNumber,
            column: columns.component,
            message: "Missing component",
          },
        };
      }

      // Color can be empty but we'll warn
      let warning: string | undefined;
      if (!color) {
        warning = `Row ${rowNumber}: Missing color value`;
      }

      // Parse lead content
      const leadContent = this.parseLeadContent(leadContentRaw);
      if (leadContent === undefined) {
        return {
          error: {
            row: rowNumber,
            column: columns.leadContent,
            message: `Invalid lead content value: ${leadContentRaw}`,
            value: leadContentRaw,
          },
        };
      }

      // Build reading object
      const unitNumber = columns.unitNumber
        ? String(row[columns.unitNumber] || "").trim() || undefined
        : undefined;
      const roomType = columns.roomType
        ? String(row[columns.roomType] || "").trim() || undefined
        : undefined;
      const roomNumber = columns.roomNumber
        ? String(row[columns.roomNumber] || "").trim() || undefined
        : undefined;

      // Build location string if not provided but components exist
      let location = columns.location
        ? String(row[columns.location] || "").trim()
        : "";
      
      if (!location && (unitNumber || roomType || roomNumber)) {
        // Auto-build location from components: "Unit 101 - Bedroom 2"
        const parts: string[] = [];
        if (unitNumber) parts.push(`Unit ${unitNumber}`);
        if (roomType) parts.push(roomNumber ? `${roomType} ${roomNumber}` : roomType);
        else if (roomNumber) parts.push(`Room ${roomNumber}`);
        location = parts.join(" - ");
      }

      const reading: IXrfReading = {
        readingId,
        component,
        color: color || "Unknown",
        leadContent,
        isPositive: leadContent >= LEAD_POSITIVE_THRESHOLD,
        location,
        unitNumber,
        roomType,
        roomNumber,
        substrate: columns.substrate
          ? String(row[columns.substrate] || "").trim() || undefined
          : undefined,
        side: columns.side
          ? String(row[columns.side] || "").trim() || undefined
          : undefined,
        condition: columns.condition
          ? String(row[columns.condition] || "").trim() || undefined
          : undefined,
        timestamp: columns.timestamp
          ? this.parseTimestamp(row[columns.timestamp])
          : undefined,
        rawRow: row,
      };

      return { reading, warning };
    } catch (error) {
      return {
        error: {
          row: rowNumber,
          message: `Failed to parse row: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }
  }

  /**
   * Parse lead content value to number
   */
  private parseLeadContent(value: unknown): number | undefined {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      // Remove common units/formatting
      const cleaned = value
        .replace(/mg\/cm[²2]/gi, "")
        .replace(/ppm/gi, "")
        .replace(/[<>]/g, "")
        .replace(/,/g, "") // Remove thousand separators
        .trim();

      // Handle "negative" or "N/A" type values
      if (
        cleaned.toLowerCase() === "negative" ||
        cleaned.toLowerCase() === "neg" ||
        cleaned === "N/A" ||
        cleaned === "-"
      ) {
        return 0;
      }

      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  }

  /**
   * Parse timestamp value
   */
  private parseTimestamp(value: unknown): Date | undefined {
    if (!value) return undefined;

    if (value instanceof Date) return value;

    if (typeof value === "number") {
      // Excel serial date (days since 1900-01-01)
      // Excel incorrectly treats 1900 as a leap year, hence -2 instead of -1
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + value * 86400 * 1000);
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }

    return undefined;
  }

  /**
   * Use AI to map columns
   */
  private async useAIColumnMapping(
    headers: string[],
    sampleData: Record<string, unknown>[]
  ): Promise<IAIColumnMapping> {
    if (!this.aiColumnMapper) {
      throw new Error("AI column mapper not configured");
    }
    return this.aiColumnMapper.mapColumns(headers, sampleData);
  }

  /**
   * Convert AI mapping result to detected columns format
   */
  private aiMappingToDetectedColumns(aiMapping: IAIColumnMapping): Record<string, string> {
    const detected: Record<string, string> = {};
    
    if (aiMapping.readingId) detected.readingId = aiMapping.readingId;
    if (aiMapping.component) detected.component = aiMapping.component;
    if (aiMapping.color) detected.color = aiMapping.color;
    if (aiMapping.leadContent) detected.leadContent = aiMapping.leadContent;
    if (aiMapping.location) detected.location = aiMapping.location;
    if (aiMapping.substrate) detected.substrate = aiMapping.substrate;
    if (aiMapping.side) detected.side = aiMapping.side;
    if (aiMapping.condition) detected.condition = aiMapping.condition;
    if (aiMapping.timestamp) detected.timestamp = aiMapping.timestamp;
    
    return detected;
  }

  /**
   * Create empty metadata object
   */
  private createEmptyMetadata(sheetName = ""): IParseMetadata {
    return {
      totalRows: 0,
      validRows: 0,
      skippedRows: 0,
      sheetName,
      detectedColumns: {},
      unmappedColumns: [],
    };
  }

  /**
   * Yield control back to the UI to prevent freezing
   */
  private yieldToUI(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, PROCESSING.CHUNK_DELAY));
  }
}

// ============================================
// Singleton Instance
// ============================================

let parserInstance: ExcelParserService | undefined;

export function getExcelParserService(): ExcelParserService {
  if (!parserInstance) {
    parserInstance = new ExcelParserService();
  }
  return parserInstance;
}
