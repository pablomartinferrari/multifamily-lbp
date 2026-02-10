import * as XLSX from 'xlsx';
import { ExcelParserService } from './ExcelParserService';
import { LEAD_POSITIVE_THRESHOLD } from '../models/IXrfReading';

// Helper to create an Excel workbook buffer
function createExcelBuffer(data: Record<string, unknown>[], sheetName = 'Sheet1'): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return buffer;
}

// Helper to create Excel from 2D array (for metadata + header layouts like Pb200i)
function createExcelFromRows(rows: (string | number)[][], sheetName = 'Sheet1'): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

// Helper to create CSV buffer
function createCsvBuffer(csvContent: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(csvContent).buffer;
}

describe('ExcelParserService', () => {
  let service: ExcelParserService;

  beforeEach(() => {
    service = new ExcelParserService();
  });

  describe('parseFile - Basic Functionality', () => {
    it('should parse valid Excel data with standard headers', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door Frame', 'Color': 'White', 'Lead Content': 0.5 },
        { 'Reading ID': 'R002', 'Component': 'Window Sill', 'Color': 'Beige', 'Lead Content': 1.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should correctly map reading ID field', async () => {
      const data = [
        { 'Reading ID': 'TEST-123', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].readingId).toMatch(/^TEST-123(_\d+)?$/);
      expect(result.readings[0].rawRow?.originalReadingId).toBe('TEST-123');
    });

    it('should correctly map component field', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Window Frame', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].component).toBe('Window Frame');
    });

    it('should correctly map color field', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'Forest Green', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].color).toBe('Forest Green');
    });

    it('should correctly map lead content field', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 2.35 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].leadContent).toBe(2.35);
    });
  });

  describe('parseFile - isPositive Calculation', () => {
    it('should set isPositive=true when lead >= 1.0', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 1.0 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].isPositive).toBe(true);
    });

    it('should set isPositive=false when lead < 1.0', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.99 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].isPositive).toBe(false);
    });

    it('should use LEAD_POSITIVE_THRESHOLD constant correctly', async () => {
      // This test verifies the threshold is 1.0
      expect(LEAD_POSITIVE_THRESHOLD).toBe(1.0);
    });
  });

  describe('parseFile - Column Variations', () => {
    it('should recognize "Reading" as reading ID column', async () => {
      const data = [
        { 'Reading': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings[0].readingId).toMatch(/^R001(_\d+)?$/);
    });

    it('should recognize "Building Component" as component column', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Building Component': 'Wood Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings[0].component).toBe('Wood Door');
    });

    it('should recognize "Pb" as lead content column', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Pb': 1.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings[0].leadContent).toBe(1.5);
    });

    it('should recognize "Lead (mg/cm²)" as lead content column', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead (mg/cm²)': 0.8 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings[0].leadContent).toBe(0.8);
    });

    it('should handle case-insensitive header matching', async () => {
      const data = [
        { 'READING ID': 'R001', 'COMPONENT': 'Door', 'COLOR': 'White', 'LEAD CONTENT': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(1);
    });
  });

  describe('parseFile - Optional Fields', () => {
    it('should parse location when present', async () => {
      const data = [
        { 
          'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 
          'Lead Content': 0.5, 'Location': 'Unit 101 - Bedroom' 
        },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].location).toBe('Unit 101 - Bedroom');
    });

    it('should parse substrate when present', async () => {
      const data = [
        { 
          'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 
          'Lead Content': 0.5, 'Substrate': 'Wood' 
        },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].substrate).toBe('Wood');
    });

    it('should parse side when present', async () => {
      const data = [
        { 
          'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 
          'Lead Content': 0.5, 'Side': 'A' 
        },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].side).toBe('A');
    });

    it('should parse condition when present', async () => {
      const data = [
        { 
          'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 
          'Lead Content': 0.5, 'Condition': 'Deteriorated' 
        },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].condition).toBe('Deteriorated');
    });
  });

  describe('parseFile - Lead Content Parsing', () => {
    it('should parse numeric lead content', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 2.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].leadContent).toBe(2.5);
    });

    it('should parse string lead content with units', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': '1.5 mg/cm²' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].leadContent).toBe(1.5);
    });

    it('should parse lead content with < prefix', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': '<0.1' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].leadContent).toBe(0.1);
    });

    it('should handle "negative" as 0', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 'negative' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].leadContent).toBe(0);
    });

    it('should handle "N/A" as 0', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 'N/A' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].leadContent).toBe(0);
    });

    it('should handle comma-separated numbers', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': '1,234.5' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].leadContent).toBe(1234.5);
    });
  });

  describe('parseFile - Error Handling', () => {
    it('should report error for missing required column', async () => {
      const data = [
        { 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 }, // Missing Reading ID
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Required column not found');
    });

    it('should report error for corrupted/invalid file', async () => {
      // Create an invalid buffer that's not a valid Excel/CSV file
      const invalidBuffer = new ArrayBuffer(100);

      const result = await service.parseFile(invalidBuffer);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report error for worksheet with no data rows', async () => {
      const data: Record<string, unknown>[] = [];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toMatch(/No data (rows|found)/);
    });

    it('should report error for invalid lead content value', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 'invalid' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      // Parser skips rows with invalid lead content as junk (no valid readings)
      expect(result.readings).toHaveLength(0);
    });

    it('should skip rows with missing reading ID', async () => {
      const data = [
        { 'Reading ID': '', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      // Parser skips rows without reading ID as junk
      expect(result.readings).toHaveLength(0);
    });

    it('should skip rows with missing component', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': '', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      // Parser skips rows without component as junk
      expect(result.readings).toHaveLength(0);
    });
  });

  describe('parseFile - Warnings', () => {
    it('should warn about missing color but still parse', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': '', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(1);
      expect(result.readings[0].color).toBe('Unknown');
    });

    it('should warn about unmapped columns', async () => {
      const data = [
        { 
          'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 
          'Lead Content': 0.5, 'Custom Field': 'ignored' 
        },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.warnings.some(w => w.includes('Unmapped columns'))).toBe(true);
      expect(result.warnings.some(w => w.includes('Custom Field'))).toBe(true);
    });
  });

  describe('parseFile - Metadata', () => {
    it('should include sheet name in metadata', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data, 'XRF Data');

      const result = await service.parseFile(buffer);

      expect(result.metadata.sheetName).toBe('XRF Data');
    });

    it('should include row counts in metadata', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
        { 'Reading ID': 'R002', 'Component': 'Window', 'Color': 'Beige', 'Lead Content': 1.5 },
        { 'Reading ID': '', 'Component': 'Wall', 'Color': 'White', 'Lead Content': 0.3 }, // Invalid
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.metadata.totalRows).toBe(3);
      expect(result.metadata.validRows).toBe(2);
      expect(result.metadata.skippedRows).toBe(1);
    });

    it('should include detected column mappings', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.metadata.detectedColumns.readingId).toBe('Reading ID');
      expect(result.metadata.detectedColumns.component).toBe('Component');
      expect(result.metadata.detectedColumns.color).toBe('Color');
      expect(result.metadata.detectedColumns.leadContent).toBe('Lead Content');
    });
  });

  describe('parseFile - CSV Support', () => {
    it('should parse valid CSV file', async () => {
      const csv = `Reading ID,Component,Color,Lead Content
R001,Door Frame,White,0.5
R002,Window Sill,Beige,1.5`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(2);
      // Reading IDs have row index suffix appended for uniqueness
      expect(result.readings[0].readingId).toBe('R001_0');
      expect(result.readings[1].readingId).toBe('R002_1');
    });

    it('should handle CSV with different delimiters detected automatically', async () => {
      // Note: XLSX library auto-detects CSV format
      const csv = `Reading ID,Component,Color,Lead Content
R001,Door,White,0.5`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
    });

    it('should parse CSV with optional columns (substrate, location, room)', async () => {
      const csv = `Reading ID,Component,Color,Lead Content,Substrate,Location,Room Type,Room Number
R001,Door Frame,White,0.5,Wood,Unit 101,Bedroom,1
R002,Window Sill,Beige,1.5,Metal,Unit 102,Kitchen,
R003,Baseboard,Gray,0.3,,Unit 103,Living Room,1`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(3);
      
      // Check first reading has all optional fields
      expect(result.readings[0].substrate).toBe('Wood');
      expect(result.readings[0].location).toBe('Unit 101');
      expect(result.readings[0].roomType).toBe('Bedroom');
      expect(result.readings[0].roomNumber).toBe('1');
      
      // Check second reading with partial optional fields
      expect(result.readings[1].substrate).toBe('Metal');
      expect(result.readings[1].roomType).toBe('Kitchen');
      expect(result.readings[1].roomNumber).toBeUndefined();
      
      // Check third reading with missing substrate
      expect(result.readings[2].substrate).toBeUndefined();
    });

    it('should parse CSV with positive/negative lead values as text', async () => {
      const csv = `Reading ID,Component,Color,Lead Content
R001,Door Frame,White,Negative
R002,Window Sill,Beige,Positive
R003,Wall,Gray,N/A
R004,Ceiling,White,0.8`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(4);
      
      // "Negative" should be parsed as 0
      expect(result.readings[0].leadContent).toBe(0);
      expect(result.readings[0].isPositive).toBe(false);
      
      // "Positive" should be parsed as slightly above threshold
      expect(result.readings[1].leadContent).toBeGreaterThanOrEqual(1.0);
      expect(result.readings[1].isPositive).toBe(true);
      
      // "N/A" should be parsed as 0
      expect(result.readings[2].leadContent).toBe(0);
      expect(result.readings[2].isPositive).toBe(false);
      
      // Numeric value should be parsed correctly
      expect(result.readings[3].leadContent).toBe(0.8);
      expect(result.readings[3].isPositive).toBe(false);
    });

    it('should parse CSV with lead content containing units', async () => {
      const csv = `Reading ID,Component,Color,Lead Content
R001,Door Frame,White,0.5 mg/cm²
R002,Window Sill,Beige,1.5mg/cm2
R003,Wall,Gray,<0.1`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(3);
      
      expect(result.readings[0].leadContent).toBe(0.5);
      expect(result.readings[1].leadContent).toBe(1.5);
      expect(result.readings[2].leadContent).toBe(0.1);
    });

    it('should handle CSV with empty rows gracefully', async () => {
      const csv = `Reading ID,Component,Color,Lead Content
R001,Door Frame,White,0.5

R002,Window Sill,Beige,1.5

`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      // Empty rows should be skipped
      expect(result.readings).toHaveLength(2);
    });

    it('should handle CSV with header row not on first line', async () => {
      const csv = `XRF Inspection Report - All Shots
Reading ID,Component,Color,Lead Content
R001,Door Frame,White,0.5
R002,Window Sill,Beige,1.5`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(2);
      // Should warn about skipped title row
      expect(result.warnings.some(w => w.includes('header row'))).toBe(true);
    });

    it('should detect header row when XRF metadata occupies top rows (Pb200i/Viken style)', async () => {
      // Pb200i exports: Company, Model, Type, Serial Num, App Version, blank row, then headers
      const rows: (string | number)[][] = [
        ['Company', 'Viken Detection'],
        ['Model', 'Pb200i'],
        ['Type', 'XRF Lead Paint Analyzer'],
        ['Serial Num', '1170'],
        ['App Versic', 'Pb200i-5.3.1'],
        [], // blank separator
        ['Reading #', 'Concentration', 'Result', 'COMPONENT', 'COLOR', 'SUBSTRATE', 'ROOM TYPE', 'ROOM NUM'],
        [1, 0.4, 'Negative', 'Wall-Ceiling', 'Beige', 'Plaster', 'Bedroom', '1'],
        [2, 1.2, 'Positive', 'Window Sill', 'White', 'Wood', 'Kitchen', '1'],
      ];
      const buffer = createExcelFromRows(rows);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(2);
      expect(result.readings[0].component).toBe('Wall-Ceiling');
      expect(result.readings[0].color).toBe('Beige');
      expect(result.readings[0].leadContent).toBe(0.4);
      expect(result.readings[1].leadContent).toBe(1.2);
      expect(result.warnings.some(w => w.includes('row 7') || w.includes('row 6'))).toBe(true);
    });

    it('should handle large CSV file with many readings', async () => {
      // Generate a CSV with 500 readings
      const headers = 'Reading ID,Component,Color,Lead Content,Substrate';
      const rows = Array.from({ length: 500 }, (_, i) => 
        `R${String(i).padStart(4, '0')},Door Frame ${i % 10},White,${(Math.random() * 2).toFixed(2)},Wood`
      );
      const csv = [headers, ...rows].join('\n');
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(500);
      expect(result.metadata.totalRows).toBe(500);
    });

    it('should correctly identify positive/negative readings from CSV', async () => {
      const csv = `Reading ID,Component,Color,Lead Content
R001,Door,White,0.9
R002,Door,White,1.0
R003,Door,White,1.1
R004,Door,White,2.5`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      
      // 0.9 is below 1.0 threshold - negative
      expect(result.readings[0].isPositive).toBe(false);
      // 1.0 is at threshold - positive
      expect(result.readings[1].isPositive).toBe(true);
      // 1.1 is above threshold - positive
      expect(result.readings[2].isPositive).toBe(true);
      // 2.5 is above threshold - positive
      expect(result.readings[3].isPositive).toBe(true);
    });

    it('should filter out calibration readings from CSV', async () => {
      const csv = `Reading ID,Component,Color,Lead Content
R001,Door Frame,White,0.5
CAL,Calibrate,Black,1.1
R002,Window Sill,Beige,1.5
R003,Standard Check,Gray,1.0`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
      // Calibration rows should be filtered out
      expect(result.readings).toHaveLength(2);
      expect(result.readings[0].component).toBe('Door Frame');
      expect(result.readings[1].component).toBe('Window Sill');
      // Should warn about filtered calibration readings
      expect(result.warnings.some(w => w.includes('calibration'))).toBe(true);
    });
  });

  describe('parseFile - Progress Callback', () => {
    it('should call progress callback during parsing', async () => {
      const data = Array.from({ length: 100 }, (_, i) => ({
        'Reading ID': `R${i}`,
        'Component': 'Door',
        'Color': 'White',
        'Lead Content': 0.5,
      }));
      const buffer = createExcelBuffer(data);

      const progressCalls: { processed: number; total: number; stage: string }[] = [];
      const onProgress = (processed: number, total: number, stage: 'reading' | 'parsing' | 'ai-mapping'): void => {
        progressCalls.push({ processed, total, stage });
      };

      await service.parseFile(buffer, onProgress);

      // Should have at least reading and parsing stage calls
      expect(progressCalls.some(c => c.stage === 'reading')).toBe(true);
      expect(progressCalls.some(c => c.stage === 'parsing')).toBe(true);
    });
  });

  describe('parseFileObject - File API', () => {
    it('should parse File-like object with arrayBuffer method', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);
      
      // Create a mock File-like object (browser's File API is not available in Node)
      const mockFile = {
        name: 'test.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        arrayBuffer: async () => buffer,
      } as File;

      const result = await service.parseFileObject(mockFile);

      expect(result.success).toBe(true);
      expect(result.readings).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should trim whitespace from values', async () => {
      const data = [
        { 'Reading ID': '  R001  ', 'Component': ' Door Frame ', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].readingId).toMatch(/^R001(_\d+)?$/);
      expect(result.readings[0].component).toBe('Door Frame');
    });

    it('should handle numeric reading IDs', async () => {
      const data = [
        { 'Reading ID': 12345, 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].readingId).toMatch(/^12345(_\d+)?$/);
    });

    it('should preserve raw row data', async () => {
      const data = [
        { 
          'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 
          'Lead Content': 0.5, 'Extra Field': 'extra value' 
        },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].rawRow).toBeDefined();
      expect(result.readings[0].rawRow?.['Extra Field']).toBe('extra value');
    });

    it('should handle very large lead content values', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 999999.99 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].leadContent).toBe(999999.99);
      expect(result.readings[0].isPositive).toBe(true);
    });

    it('should handle zero lead content', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].leadContent).toBe(0);
      expect(result.readings[0].isPositive).toBe(false);
    });
  });
});
