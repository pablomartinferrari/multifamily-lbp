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

      expect(result.readings[0].readingId).toBe('TEST-123');
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
      expect(result.readings[0].readingId).toBe('R001');
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
      expect(result.errors[0].message).toContain('No data rows');
    });

    it('should report error for invalid lead content value', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': 'Door', 'Color': 'White', 'Lead Content': 'invalid' },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Invalid lead content');
    });

    it('should report error for missing reading ID in row', async () => {
      const data = [
        { 'Reading ID': '', 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Missing reading ID');
    });

    it('should report error for missing component in row', async () => {
      const data = [
        { 'Reading ID': 'R001', 'Component': '', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('Missing component');
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
      expect(result.warnings.some(w => w.includes('Missing color'))).toBe(true);
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
      expect(result.readings[0].readingId).toBe('R001');
      expect(result.readings[1].readingId).toBe('R002');
    });

    it('should handle CSV with different delimiters detected automatically', async () => {
      // Note: XLSX library auto-detects CSV format
      const csv = `Reading ID,Component,Color,Lead Content
R001,Door,White,0.5`;
      const buffer = createCsvBuffer(csv);

      const result = await service.parseFile(buffer);

      expect(result.success).toBe(true);
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

      expect(result.readings[0].readingId).toBe('R001');
      expect(result.readings[0].component).toBe('Door Frame');
    });

    it('should handle numeric reading IDs', async () => {
      const data = [
        { 'Reading ID': 12345, 'Component': 'Door', 'Color': 'White', 'Lead Content': 0.5 },
      ];
      const buffer = createExcelBuffer(data);

      const result = await service.parseFile(buffer);

      expect(result.readings[0].readingId).toBe('12345');
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
