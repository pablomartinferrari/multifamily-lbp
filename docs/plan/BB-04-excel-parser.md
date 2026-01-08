# BB-04: Excel Parser Service

> **Priority**: 🟡 High  
> **Estimated Effort**: 3-4 hours  
> **Dependencies**: BB-01  
> **Status**: ✅ Complete

---

## Objective

Create a service that parses XRF Excel files using SheetJS and maps the data to typed `IXrfReading` objects.

---

## Prerequisites

- BB-01 completed (SPFx project with xlsx library installed)
- Sample XRF Excel file (for column mapping) - **if not available, create mock structure**

---

## Tasks

### 1. Create XRF Reading Model

Create `src/models/IXrfReading.ts`:

```typescript
/**
 * Represents a single XRF reading from the inspection device
 */
export interface IXrfReading {
  // === CRITICAL FIELDS ===
  readingId: string;            // Unique identifier for this reading
  component: string;            // Raw component name from XRF device (e.g., "door jamb")
  color: string;                // Paint color at reading location
  leadContent: number;          // Lead concentration in mg/cm²

  // === CALCULATED FIELDS (added by system) ===
  normalizedComponent?: string; // AI-normalized component name
  isPositive: boolean;          // true if leadContent >= 1.0

  // === LOCATION FIELDS ===
  location: string;             // Full location string (e.g., "Unit 101 - Bedroom")
  // Future expansion:
  // roomType?: string;         // e.g., "Bedroom", "Kitchen"
  // roomNumber?: string;       // e.g., "101", "2A"

  // === ADDITIONAL FIELDS ===
  substrate?: string;           // Surface material (e.g., "Wood", "Metal", "Drywall")
  side?: string;                // Side indicator (e.g., "A", "B" for doors)
  condition?: string;           // Paint condition (e.g., "Intact", "Deteriorated")
  timestamp?: Date;             // When reading was taken
  
  // === RAW DATA ===
  rawRow?: Record<string, unknown>; // Original Excel row data for debugging
}

/**
 * Lead content threshold for positive classification
 */
export const LEAD_POSITIVE_THRESHOLD = 1.0; // mg/cm²
```

### 2. Create Column Mapping Configuration

Create `src/config/ExcelColumnMapping.ts`:

```typescript
/**
 * Maps Excel column headers to IXrfReading properties
 * Update these mappings based on actual XRF device export format
 */
export interface IColumnMapping {
  // Required columns
  readingId: string[];      // Possible column names for reading ID
  component: string[];      // Possible column names for component
  color: string[];          // Possible column names for color
  leadContent: string[];    // Possible column names for lead content

  // Optional columns
  location: string[];
  substrate: string[];
  side: string[];
  condition: string[];
  timestamp: string[];
}

/**
 * Default column mappings
 * Add variations based on different XRF device exports
 */
export const DEFAULT_COLUMN_MAPPING: IColumnMapping = {
  // Reading ID variations
  readingId: [
    "Reading ID",
    "ReadingID",
    "Reading #",
    "Reading Number",
    "ID",
    "Rdg",
    "Reading",
  ],

  // Component variations
  component: [
    "Component",
    "Building Component",
    "Comp",
    "Component Type",
    "Testing Component",
    "Substrate Component",
  ],

  // Color variations
  color: [
    "Color",
    "Paint Color",
    "Colour",
    "Surface Color",
  ],

  // Lead content variations (mg/cm²)
  leadContent: [
    "Lead Content",
    "Lead (mg/cm²)",
    "Lead",
    "Pb",
    "Pb Content",
    "Result",
    "XRF Result",
    "Lead Concentration",
    "mg/cm²",
    "PbC",
  ],

  // Location variations
  location: [
    "Location",
    "Room",
    "Unit",
    "Area",
    "Room Location",
    "Test Location",
  ],

  // Substrate variations
  substrate: [
    "Substrate",
    "Surface",
    "Material",
    "Substrate Type",
  ],

  // Side variations
  side: [
    "Side",
    "Surface Side",
    "A/B",
  ],

  // Condition variations
  condition: [
    "Condition",
    "Paint Condition",
    "Surface Condition",
  ],

  // Timestamp variations
  timestamp: [
    "Date",
    "Time",
    "DateTime",
    "Timestamp",
    "Reading Date",
    "Test Date",
  ],
};

/**
 * Find matching column in Excel headers
 */
export function findColumnMatch(headers: string[], possibleNames: string[]): string | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().trim();
    const index = normalizedHeaders.indexOf(normalizedName);
    if (index !== -1) {
      return headers[index]; // Return original case
    }
  }
  
  return null;
}
```

### 3. Create Excel Parser Service

Create `src/services/ExcelParserService.ts`:

```typescript
import * as XLSX from "xlsx";
import { IXrfReading, LEAD_POSITIVE_THRESHOLD } from "../models/IXrfReading";
import { 
  DEFAULT_COLUMN_MAPPING, 
  IColumnMapping, 
  findColumnMatch 
} from "../config/ExcelColumnMapping";

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
  detectedColumns: Record<string, string>; // property -> actual column name
}

export class ExcelParserService {
  private columnMapping: IColumnMapping;

  constructor(columnMapping: IColumnMapping = DEFAULT_COLUMN_MAPPING) {
    this.columnMapping = columnMapping;
  }

  /**
   * Parse an Excel file buffer into XRF readings
   */
  async parseFile(fileBuffer: ArrayBuffer): Promise<IParseResult> {
    const errors: IParseError[] = [];
    const warnings: string[] = [];
    const readings: IXrfReading[] = [];

    try {
      // Read workbook
      const workbook = XLSX.read(fileBuffer, { type: "array" });
      
      // Get first sheet (or could make configurable)
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return {
          success: false,
          readings: [],
          errors: [{ row: 0, message: "No worksheets found in Excel file" }],
          warnings: [],
          metadata: this.createEmptyMetadata(),
        };
      }

      const sheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with headers
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "", // Default value for empty cells
      });

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
      
      // Detect column mappings
      const detectedColumns = this.detectColumns(headers);
      
      // Validate required columns
      const missingRequired = this.validateRequiredColumns(detectedColumns);
      if (missingRequired.length > 0) {
        return {
          success: false,
          readings: [],
          errors: missingRequired.map(col => ({
            row: 0,
            message: `Required column not found: ${col}`,
          })),
          warnings: [],
          metadata: {
            totalRows: jsonData.length,
            validRows: 0,
            skippedRows: jsonData.length,
            sheetName,
            detectedColumns,
          },
        };
      }

      // Parse each row
      let rowNumber = 2; // Excel rows start at 1, header is row 1
      for (const row of jsonData) {
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
      }

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
        },
      };
    } catch (error) {
      return {
        success: false,
        readings: [],
        errors: [{
          row: 0,
          message: `Failed to parse Excel file: ${error instanceof Error ? error.message : String(error)}`,
        }],
        warnings: [],
        metadata: this.createEmptyMetadata(),
      };
    }
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

    const leadContentCol = findColumnMatch(headers, this.columnMapping.leadContent);
    if (leadContentCol) detected.leadContent = leadContentCol;

    // Optional fields
    const locationCol = findColumnMatch(headers, this.columnMapping.location);
    if (locationCol) detected.location = locationCol;

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
  private validateRequiredColumns(detectedColumns: Record<string, string>): string[] {
    const required = ["readingId", "component", "color", "leadContent"];
    return required.filter(col => !detectedColumns[col]);
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
        return { error: { row: rowNumber, column: columns.readingId, message: "Missing reading ID" } };
      }
      if (!component) {
        return { error: { row: rowNumber, column: columns.component, message: "Missing component" } };
      }
      if (!color) {
        return { warning: `Row ${rowNumber}: Missing color value` };
      }

      // Parse lead content
      const leadContent = this.parseLeadContent(leadContentRaw);
      if (leadContent === null) {
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
      const reading: IXrfReading = {
        readingId,
        component,
        color,
        leadContent,
        isPositive: leadContent >= LEAD_POSITIVE_THRESHOLD,
        location: columns.location ? String(row[columns.location] || "").trim() : "",
        substrate: columns.substrate ? String(row[columns.substrate] || "").trim() : undefined,
        side: columns.side ? String(row[columns.side] || "").trim() : undefined,
        condition: columns.condition ? String(row[columns.condition] || "").trim() : undefined,
        timestamp: columns.timestamp ? this.parseTimestamp(row[columns.timestamp]) : undefined,
        rawRow: row,
      };

      return { reading };
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
  private parseLeadContent(value: unknown): number | null {
    if (typeof value === "number") {
      return value;
    }
    
    if (typeof value === "string") {
      // Remove common units/formatting
      const cleaned = value
        .replace(/mg\/cm²/gi, "")
        .replace(/ppm/gi, "")
        .replace(/[<>]/g, "")
        .trim();
      
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    
    return null;
  }

  /**
   * Parse timestamp value
   */
  private parseTimestamp(value: unknown): Date | undefined {
    if (!value) return undefined;
    
    if (value instanceof Date) return value;
    
    if (typeof value === "number") {
      // Excel serial date
      return new Date((value - 25569) * 86400 * 1000);
    }
    
    if (typeof value === "string") {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    }
    
    return undefined;
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
    };
  }
}
```

### 4. Create Unit Tests

Create `src/services/ExcelParserService.test.ts`:

```typescript
import { ExcelParserService, IParseResult } from "./ExcelParserService";
import * as XLSX from "xlsx";

describe("ExcelParserService", () => {
  let service: ExcelParserService;

  beforeEach(() => {
    service = new ExcelParserService();
  });

  /**
   * Helper to create mock Excel buffer
   */
  function createMockExcel(data: Record<string, unknown>[]): ArrayBuffer {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    return XLSX.write(wb, { type: "array", bookType: "xlsx" });
  }

  describe("parseFile", () => {
    it("should parse valid XRF data", async () => {
      const mockData = [
        { "Reading ID": "001", "Component": "Door Jamb", "Color": "White", "Lead Content": 0.5 },
        { "Reading ID": "002", "Component": "Window Sill", "Color": "Blue", "Lead Content": 1.5 },
      ];

      const buffer = createMockExcel(mockData);
      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(2);
      expect(result.readings[0].component).toBe("Door Jamb");
      expect(result.readings[0].isPositive).toBe(false);
      expect(result.readings[1].isPositive).toBe(true);
    });

    it("should detect column variations", async () => {
      const mockData = [
        { "Rdg": "001", "Building Component": "Wall", "Paint Color": "Red", "Pb": 2.0 },
      ];

      const buffer = createMockExcel(mockData);
      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings[0].readingId).toBe("001");
      expect(result.readings[0].component).toBe("Wall");
      expect(result.readings[0].color).toBe("Red");
      expect(result.readings[0].leadContent).toBe(2.0);
    });

    it("should report missing required columns", async () => {
      const mockData = [
        { "Reading ID": "001", "Color": "White", "Lead Content": 0.5 },
      ];

      const buffer = createMockExcel(mockData);
      const result = await service.parseFile(buffer);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.message.includes("component"))).toBe(true);
    });

    it("should calculate isPositive correctly at threshold", async () => {
      const mockData = [
        { "Reading ID": "001", "Component": "Test", "Color": "White", "Lead Content": 0.99 },
        { "Reading ID": "002", "Component": "Test", "Color": "White", "Lead Content": 1.0 },
        { "Reading ID": "003", "Component": "Test", "Color": "White", "Lead Content": 1.01 },
      ];

      const buffer = createMockExcel(mockData);
      const result = await service.parseFile(buffer);

      expect(result.readings[0].isPositive).toBe(false); // 0.99 < 1.0
      expect(result.readings[1].isPositive).toBe(true);  // 1.0 >= 1.0
      expect(result.readings[2].isPositive).toBe(true);  // 1.01 >= 1.0
    });
  });
});
```

---

## Acceptance Criteria

- [ ] Can parse .xlsx file to IXrfReading[]
- [ ] Detects column names with variations (case-insensitive, multiple names)
- [ ] `color` field extracted correctly
- [ ] `isPositive` calculated correctly (leadContent >= 1.0)
- [ ] Reports clear errors for missing required columns
- [ ] Handles parsing errors gracefully (doesn't crash on bad data)
- [ ] Unit tests pass

---

## Output Artifacts

```
src/
├── models/
│   └── IXrfReading.ts
├── config/
│   └── ExcelColumnMapping.ts
├── services/
│   ├── ExcelParserService.ts
│   └── ExcelParserService.test.ts
```

---

## Column Mapping Reference

When a sample XRF file is available, update `ExcelColumnMapping.ts` with the actual column names from the device export.

Current supported variations:

| Property | Recognized Column Names |
|----------|------------------------|
| readingId | Reading ID, ReadingID, Reading #, ID, Rdg |
| component | Component, Building Component, Comp |
| color | Color, Paint Color, Colour, Surface Color |
| leadContent | Lead Content, Lead (mg/cm²), Lead, Pb, Result |
| location | Location, Room, Unit, Area |
| substrate | Substrate, Surface, Material |

---

## Next Steps

Once this building block is complete:
1. ➡️ Proceed to **BB-05: Summary Service**
2. The Summary Service will use parsed readings to generate categorized summaries



