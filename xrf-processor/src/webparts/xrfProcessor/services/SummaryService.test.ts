import { SummaryService } from './SummaryService';
import { IXrfReading, LEAD_POSITIVE_THRESHOLD } from '../models/IXrfReading';
import {
  STATISTICAL_SAMPLE_SIZE,
  POSITIVE_PERCENT_THRESHOLD,
} from '../models/ISummary';

// Helper to create mock readings
function createReading(
  component: string,
  leadContent: number,
  overrides: Partial<IXrfReading> = {}
): IXrfReading {
  return {
    readingId: `R-${Math.random().toString(36).substr(2, 9)}`,
    component,
    color: 'White',
    leadContent,
    isPositive: leadContent >= LEAD_POSITIVE_THRESHOLD,
    location: 'Unit 101',
    ...overrides,
  };
}

// Helper to create multiple readings for a component
function createReadings(
  component: string,
  count: number,
  positiveRatio: number = 0
): IXrfReading[] {
  const readings: IXrfReading[] = [];
  const positiveCount = Math.round(count * positiveRatio);

  for (let i = 0; i < count; i++) {
    const isPositive = i < positiveCount;
    readings.push(
      createReading(component, isPositive ? 1.5 : 0.3)
    );
  }

  return readings;
}

describe('SummaryService', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
  });

  describe('Constants', () => {
    it('should have correct statistical sample size threshold', () => {
      expect(STATISTICAL_SAMPLE_SIZE).toBe(40);
    });

    it('should have correct positive percent threshold', () => {
      expect(POSITIVE_PERCENT_THRESHOLD).toBe(2.5);
    });

    it('should have correct lead positive threshold', () => {
      expect(LEAD_POSITIVE_THRESHOLD).toBe(1.0);
    });
  });

  describe('classifyDataset - Average Components (≥40 readings)', () => {
    it('should classify component with ≥40 readings as AVERAGE', () => {
      const readings = createReadings('Door Frame', 50, 0);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents).toHaveLength(1);
      expect(result.uniformComponents).toHaveLength(0);
      expect(result.nonUniformComponents).toHaveLength(0);
      expect(result.averageComponents[0].component).toBe('Door Frame');
    });

    it('should mark AVERAGE as NEGATIVE when ≤2.5% positive', () => {
      // 40 readings, 1 positive = 2.5% (threshold boundary)
      const readings = createReadings('Door Frame', 40, 0.025);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents[0].result).toBe('NEGATIVE');
      expect(result.averageComponents[0].positivePercent).toBe(2.5);
    });

    it('should mark AVERAGE as POSITIVE when >2.5% positive', () => {
      // 40 readings, 2 positive = 5%
      const readings = createReadings('Door Frame', 40, 0.05);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents[0].result).toBe('POSITIVE');
      expect(result.averageComponents[0].positivePercent).toBe(5);
    });

    it('should mark AVERAGE as NEGATIVE when 0% positive', () => {
      const readings = createReadings('Door Frame', 45, 0);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents[0].result).toBe('NEGATIVE');
      expect(result.averageComponents[0].positiveCount).toBe(0);
      expect(result.averageComponents[0].negativeCount).toBe(45);
    });

    it('should mark AVERAGE as POSITIVE when 100% positive', () => {
      const readings = createReadings('Door Frame', 40, 1.0);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents[0].result).toBe('POSITIVE');
      expect(result.averageComponents[0].positivePercent).toBe(100);
    });

    it('should calculate correct percentages', () => {
      // 50 readings, 15 positive = 30%
      const readings = createReadings('Window Sill', 50, 0.30);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents[0].totalReadings).toBe(50);
      expect(result.averageComponents[0].positiveCount).toBe(15);
      expect(result.averageComponents[0].negativeCount).toBe(35);
      expect(result.averageComponents[0].positivePercent).toBe(30);
      expect(result.averageComponents[0].negativePercent).toBe(70);
    });
  });

  describe('classifyDataset - Uniform Components (<40 readings, all same)', () => {
    it('should classify <40 all-negative readings as UNIFORM NEGATIVE', () => {
      const readings = createReadings('Baseboard', 20, 0);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents).toHaveLength(0);
      expect(result.uniformComponents).toHaveLength(1);
      expect(result.nonUniformComponents).toHaveLength(0);
      expect(result.uniformComponents[0].result).toBe('NEGATIVE');
      expect(result.uniformComponents[0].totalReadings).toBe(20);
    });

    it('should classify <40 all-positive readings as UNIFORM POSITIVE', () => {
      const readings = createReadings('Window Trim', 15, 1.0);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.uniformComponents).toHaveLength(1);
      expect(result.uniformComponents[0].result).toBe('POSITIVE');
      expect(result.uniformComponents[0].totalReadings).toBe(15);
    });

    it('should handle single reading as UNIFORM', () => {
      const readings = [createReading('Ceiling', 0.5)];
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.uniformComponents).toHaveLength(1);
      expect(result.uniformComponents[0].result).toBe('NEGATIVE');
      expect(result.uniformComponents[0].totalReadings).toBe(1);
    });

    it('should classify exactly 39 all-same readings as UNIFORM', () => {
      const readings = createReadings('Door', 39, 0);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.uniformComponents).toHaveLength(1);
      expect(result.averageComponents).toHaveLength(0);
    });
  });

  describe('classifyDataset - Non-Uniform Components (<40 readings, mixed)', () => {
    it('should classify <40 mixed readings as NON_UNIFORM', () => {
      const readings = createReadings('Wall', 20, 0.5); // 10 pos, 10 neg
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents).toHaveLength(0);
      expect(result.uniformComponents).toHaveLength(0);
      expect(result.nonUniformComponents).toHaveLength(1);
      expect(result.nonUniformComponents[0].component).toBe('Wall');
    });

    it('should include all readings in NON_UNIFORM summary', () => {
      const readings = createReadings('Cabinet', 10, 0.3);
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.nonUniformComponents[0].readings).toHaveLength(10);
      expect(result.nonUniformComponents[0].positiveCount).toBe(3);
      expect(result.nonUniformComponents[0].negativeCount).toBe(7);
    });

    it('should calculate correct percentages for NON_UNIFORM', () => {
      const readings = createReadings('Shelf', 25, 0.20); // 5 pos, 20 neg
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.nonUniformComponents[0].positivePercent).toBe(20);
      expect(result.nonUniformComponents[0].negativePercent).toBe(80);
    });

    it('should handle single positive in otherwise negative set', () => {
      const readings = createReadings('Railing', 10, 0.1); // 1 pos, 9 neg
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.nonUniformComponents).toHaveLength(1);
      expect(result.nonUniformComponents[0].positiveCount).toBe(1);
    });
  });

  describe('classifyDataset - Multiple Components', () => {
    it('should correctly classify multiple components into different categories', () => {
      const readings = [
        // 45 readings for Door = AVERAGE
        ...createReadings('Door', 45, 0.1),
        // 20 all negative for Window = UNIFORM NEGATIVE
        ...createReadings('Window', 20, 0),
        // 15 all positive for Trim = UNIFORM POSITIVE
        ...createReadings('Trim', 15, 1.0),
        // 10 mixed for Wall = NON_UNIFORM
        ...createReadings('Wall', 10, 0.5),
      ];

      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents).toHaveLength(1);
      expect(result.uniformComponents).toHaveLength(2);
      expect(result.nonUniformComponents).toHaveLength(1);

      expect(result.averageComponents[0].component).toBe('Door');
      expect(result.uniformComponents.map(c => c.component).sort()).toEqual(['Trim', 'Window']);
      expect(result.nonUniformComponents[0].component).toBe('Wall');
    });

    it('should sort components alphabetically within each category', () => {
      const readings = [
        ...createReadings('Zebra Component', 40, 0),
        ...createReadings('Alpha Component', 40, 0),
        ...createReadings('Middle Component', 40, 0),
      ];

      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.averageComponents.map(c => c.component)).toEqual([
        'Alpha Component',
        'Middle Component',
        'Zebra Component',
      ]);
    });

    it('should calculate correct totals across all components', () => {
      const readings = [
        ...createReadings('A', 30, 0.5),  // 15 pos, 15 neg
        ...createReadings('B', 20, 0.25), // 5 pos, 15 neg
      ];

      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.totalReadings).toBe(50);
      expect(result.totalPositive).toBe(20);
      expect(result.totalNegative).toBe(30);
      expect(result.uniqueComponents).toBe(2);
    });
  });

  describe('classifyDataset - Normalized Components', () => {
    it('should group by normalizedComponent when available', () => {
      const readings = [
        createReading('door jamb', 0.5, { normalizedComponent: 'Door Frame' }),
        createReading('door frame', 0.3, { normalizedComponent: 'Door Frame' }),
        createReading('DOOR JAMB', 0.4, { normalizedComponent: 'Door Frame' }),
      ];

      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.uniqueComponents).toBe(1);
      expect(result.uniformComponents[0].component).toBe('Door Frame');
      expect(result.uniformComponents[0].totalReadings).toBe(3);
    });

    it('should use raw component when normalizedComponent is not set', () => {
      const readings = [
        createReading('door jamb', 0.5),
        createReading('Door Jamb', 0.3),
      ];

      const result = service.classifyDataset(readings, 'UNITS');

      // Without normalization, these are treated as different components
      expect(result.uniqueComponents).toBe(2);
    });
  });

  describe('generateJobSummary', () => {
    it('should create job summary with both datasets', () => {
      const commonReadings = createReadings('Lobby Door', 10, 0);
      const unitReadings = createReadings('Bedroom Door', 20, 0);

      const result = service.generateJobSummary(
        'JOB-001',
        'test.xlsx',
        commonReadings,
        unitReadings,
        5
      );

      expect(result.jobNumber).toBe('JOB-001');
      expect(result.sourceFileName).toBe('test.xlsx');
      expect(result.aiNormalizationsApplied).toBe(5);
      expect(result.commonAreaSummary).toBeDefined();
      expect(result.unitsSummary).toBeDefined();
      expect(result.commonAreaSummary?.datasetType).toBe('COMMON_AREA');
      expect(result.unitsSummary?.datasetType).toBe('UNITS');
    });

    it('should handle undefined common area readings', () => {
      const unitReadings = createReadings('Door', 10, 0);

      const result = service.generateJobSummary(
        'JOB-002',
        'test.xlsx',
        undefined,
        unitReadings
      );

      expect(result.commonAreaSummary).toBeUndefined();
      expect(result.unitsSummary).toBeDefined();
    });

    it('should handle undefined unit readings', () => {
      const commonReadings = createReadings('Door', 10, 0);

      const result = service.generateJobSummary(
        'JOB-003',
        'test.xlsx',
        commonReadings,
        undefined
      );

      expect(result.commonAreaSummary).toBeDefined();
      expect(result.unitsSummary).toBeUndefined();
    });

    it('should handle empty arrays as undefined summaries', () => {
      const result = service.generateJobSummary(
        'JOB-004',
        'test.xlsx',
        [],
        []
      );

      expect(result.commonAreaSummary).toBeUndefined();
      expect(result.unitsSummary).toBeUndefined();
    });

    it('should include processedDate', () => {
      const result = service.generateJobSummary('JOB-005', 'test.xlsx', undefined, undefined);
      
      expect(result.processedDate).toBeDefined();
      // Should be a valid ISO date string
      expect(() => new Date(result.processedDate)).not.toThrow();
    });
  });

  describe('calculateStats', () => {
    it('should calculate correct statistics', () => {
      const readings = [
        ...createReadings('A', 45, 0.2),  // AVERAGE
        ...createReadings('B', 20, 0),    // UNIFORM
        ...createReadings('C', 10, 0.5),  // NON_UNIFORM
      ];
      const summary = service.classifyDataset(readings, 'UNITS');
      const stats = service.calculateStats(summary);

      expect(stats.totalReadings).toBe(75);
      expect(stats.uniqueComponents).toBe(3);
      expect(stats.averageComponentCount).toBe(1);
      expect(stats.uniformComponentCount).toBe(1);
      expect(stats.nonUniformComponentCount).toBe(1);
    });
  });

  describe('getClassificationCounts', () => {
    it('should count classifications correctly', () => {
      const readings = [
        ...createReadings('Avg-Pos', 40, 0.5),   // AVERAGE POSITIVE
        ...createReadings('Avg-Neg', 40, 0),     // AVERAGE NEGATIVE
        ...createReadings('Uni-Pos', 10, 1.0),   // UNIFORM POSITIVE
        ...createReadings('Uni-Neg', 10, 0),     // UNIFORM NEGATIVE
        ...createReadings('Non-Uni', 10, 0.5),   // NON_UNIFORM
      ];
      const summary = service.classifyDataset(readings, 'UNITS');
      const counts = service.getClassificationCounts(summary);

      expect(counts.averagePositive).toBe(1);
      expect(counts.averageNegative).toBe(1);
      expect(counts.uniformPositive).toBe(1);
      expect(counts.uniformNegative).toBe(1);
      expect(counts.nonUniformCount).toBe(1);
    });
  });

  describe('getAllPositiveComponents', () => {
    it('should return all components with positive readings', () => {
      const readings = [
        ...createReadings('Avg-Pos', 40, 0.5),   // AVERAGE POSITIVE
        ...createReadings('Avg-Neg', 40, 0),     // AVERAGE NEGATIVE (excluded)
        ...createReadings('Uni-Pos', 10, 1.0),   // UNIFORM POSITIVE
        ...createReadings('Uni-Neg', 10, 0),     // UNIFORM NEGATIVE (excluded)
        ...createReadings('Non-Uni', 10, 0.5),   // NON_UNIFORM (has positives)
      ];
      const summary = service.classifyDataset(readings, 'UNITS');
      const positives = service.getAllPositiveComponents(summary);

      expect(positives).toContain('Avg-Pos');
      expect(positives).toContain('Uni-Pos');
      expect(positives).toContain('Non-Uni');
      expect(positives).not.toContain('Avg-Neg');
      expect(positives).not.toContain('Uni-Neg');
      expect(positives).toHaveLength(3);
    });

    it('should return sorted list', () => {
      const readings = [
        ...createReadings('Zebra', 10, 1.0),
        ...createReadings('Alpha', 10, 1.0),
      ];
      const summary = service.classifyDataset(readings, 'UNITS');
      const positives = service.getAllPositiveComponents(summary);

      expect(positives).toEqual(['Alpha', 'Zebra']);
    });
  });

  describe('toJson / fromJson', () => {
    it('should serialize and deserialize job summary', () => {
      const readings = createReadings('Door', 50, 0.1);
      const original = service.generateJobSummary('JOB-001', 'test.xlsx', readings, undefined);

      const json = service.toJson(original);
      const parsed = service.fromJson(json);

      expect(parsed.jobNumber).toBe(original.jobNumber);
      expect(parsed.sourceFileName).toBe(original.sourceFileName);
      expect(parsed.commonAreaSummary?.totalReadings).toBe(50);
    });
  });

  describe('generateSummaryFileName', () => {
    it('should generate correct filename for Units', () => {
      const filename = service.generateSummaryFileName('JOB-123', 'Units');
      
      expect(filename).toMatch(/^JOB-123-units-summary-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it('should generate correct filename for Common Areas', () => {
      const filename = service.generateSummaryFileName('JOB-456', 'Common Areas');
      
      expect(filename).toMatch(/^JOB-456-common-areas-summary-\d{4}-\d{2}-\d{2}\.json$/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty readings array', () => {
      const result = service.classifyDataset([], 'UNITS');

      expect(result.totalReadings).toBe(0);
      expect(result.averageComponents).toHaveLength(0);
      expect(result.uniformComponents).toHaveLength(0);
      expect(result.nonUniformComponents).toHaveLength(0);
    });

    it('should handle readings at exactly threshold boundary (1.0 mg/cm²)', () => {
      const readings = [
        createReading('Test', 1.0),  // Exactly at threshold = POSITIVE
        createReading('Test', 0.99), // Just below = NEGATIVE
      ];
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.nonUniformComponents[0].positiveCount).toBe(1);
      expect(result.nonUniformComponents[0].negativeCount).toBe(1);
    });

    it('should handle very high lead content values', () => {
      const readings = [createReading('High Lead', 999.99)];
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.uniformComponents[0].result).toBe('POSITIVE');
    });

    it('should handle zero lead content', () => {
      const readings = [createReading('Zero Lead', 0)];
      const result = service.classifyDataset(readings, 'UNITS');

      expect(result.uniformComponents[0].result).toBe('NEGATIVE');
    });
  });
});
