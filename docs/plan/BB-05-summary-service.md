# BB-05: Summary Service

> **Priority**: 🟡 High  
> **Estimated Effort**: 4-6 hours  
> **Dependencies**: BB-04 (Excel Parser)  
> **Status**: ✅ Complete

---

## Objective

Implement the HUD/EPA summary classification logic that categorizes components into Average, Uniform, and Non-Uniform summaries.

---

## Prerequisites

- BB-04 completed (Excel Parser with IXrfReading model)
- Understanding of the three summary types (see REQUIREMENTS.md)

---

## Tasks

### 1. Create Summary Models

Create `src/models/ISummary.ts`:

```typescript
import { IXrfReading } from "./IXrfReading";

// ============================================
// CONSTANTS
// ============================================

export const LEAD_POSITIVE_THRESHOLD = 1.0;      // mg/cm² - reading is positive if >= this
export const STATISTICAL_SAMPLE_SIZE = 40;        // readings needed for average method
export const POSITIVE_PERCENT_THRESHOLD = 2.5;    // % positive to classify component as positive

// ============================================
// SUMMARY TYPES
// ============================================

/**
 * Average Components Summary
 * For components with ≥40 readings (statistical sampling)
 */
export interface IAverageComponentSummary {
  component: string;
  totalReadings: number;
  positiveCount: number;
  negativeCount: number;
  positivePercent: number;
  negativePercent: number;
  result: "POSITIVE" | "NEGATIVE";
}

/**
 * Uniform Component Summary
 * For components with <40 readings where ALL are same result
 */
export interface IUniformComponentSummary {
  component: string;
  totalReadings: number;
  result: "POSITIVE" | "NEGATIVE";
}

/**
 * Non-Uniform Component Summary
 * For components with <40 readings with MIXED results
 */
export interface INonUniformComponentSummary {
  component: string;
  totalReadings: number;
  positiveCount: number;
  negativeCount: number;
  positivePercent: number;
  negativePercent: number;
  readings: IXrfReading[];
}

/**
 * Complete summary for one dataset (Common Area or Units)
 */
export interface IDatasetSummary {
  datasetType: "COMMON_AREA" | "UNITS";
  totalReadings: number;
  totalPositive: number;
  totalNegative: number;
  uniqueComponents: number;
  averageComponents: IAverageComponentSummary[];
  uniformComponents: IUniformComponentSummary[];
  nonUniformComponents: INonUniformComponentSummary[];
}

/**
 * Complete job summary
 */
export interface IJobSummary {
  jobNumber: string;
  processedDate: string;
  sourceFileName: string;
  aiNormalizationsApplied: number;
  commonAreaSummary: IDatasetSummary | null;
  unitsSummary: IDatasetSummary | null;
}

/**
 * Summary statistics for display
 */
export interface ISummaryStats {
  totalReadings: number;
  totalPositive: number;
  totalNegative: number;
  positivePercent: number;
  uniqueComponents: number;
  averageComponentCount: number;
  uniformComponentCount: number;
  nonUniformComponentCount: number;
}
```

### 2. Create Summary Service

Create `src/services/SummaryService.ts`:

```typescript
import { IXrfReading, LEAD_POSITIVE_THRESHOLD } from "../models/IXrfReading";
import {
  IDatasetSummary,
  IJobSummary,
  IAverageComponentSummary,
  IUniformComponentSummary,
  INonUniformComponentSummary,
  ISummaryStats,
  STATISTICAL_SAMPLE_SIZE,
  POSITIVE_PERCENT_THRESHOLD,
} from "../models/ISummary";

export class SummaryService {
  /**
   * Generate a complete job summary from readings
   */
  generateJobSummary(
    jobNumber: string,
    sourceFileName: string,
    commonAreaReadings: IXrfReading[] | null,
    unitReadings: IXrfReading[] | null,
    aiNormalizationsApplied: number = 0
  ): IJobSummary {
    return {
      jobNumber,
      processedDate: new Date().toISOString(),
      sourceFileName,
      aiNormalizationsApplied,
      commonAreaSummary: commonAreaReadings 
        ? this.classifyDataset(commonAreaReadings, "COMMON_AREA")
        : null,
      unitsSummary: unitReadings
        ? this.classifyDataset(unitReadings, "UNITS")
        : null,
    };
  }

  /**
   * Classify readings into the three summary categories
   */
  classifyDataset(
    readings: IXrfReading[],
    datasetType: "COMMON_AREA" | "UNITS"
  ): IDatasetSummary {
    // Group readings by normalized component (or raw component if not normalized)
    const byComponent = this.groupByComponent(readings);

    const averageComponents: IAverageComponentSummary[] = [];
    const uniformComponents: IUniformComponentSummary[] = [];
    const nonUniformComponents: INonUniformComponentSummary[] = [];

    for (const [component, componentReadings] of Object.entries(byComponent)) {
      const classification = this.classifyComponent(component, componentReadings);

      switch (classification.type) {
        case "AVERAGE":
          averageComponents.push(classification.summary as IAverageComponentSummary);
          break;
        case "UNIFORM":
          uniformComponents.push(classification.summary as IUniformComponentSummary);
          break;
        case "NON_UNIFORM":
          nonUniformComponents.push(classification.summary as INonUniformComponentSummary);
          break;
      }
    }

    // Sort each category by component name
    averageComponents.sort((a, b) => a.component.localeCompare(b.component));
    uniformComponents.sort((a, b) => a.component.localeCompare(b.component));
    nonUniformComponents.sort((a, b) => a.component.localeCompare(b.component));

    // Calculate totals
    const totalPositive = readings.filter(r => r.isPositive).length;

    return {
      datasetType,
      totalReadings: readings.length,
      totalPositive,
      totalNegative: readings.length - totalPositive,
      uniqueComponents: Object.keys(byComponent).length,
      averageComponents,
      uniformComponents,
      nonUniformComponents,
    };
  }

  /**
   * Group readings by component name
   */
  private groupByComponent(readings: IXrfReading[]): Record<string, IXrfReading[]> {
    const groups: Record<string, IXrfReading[]> = {};

    for (const reading of readings) {
      // Use normalized component if available, otherwise use raw component
      const component = reading.normalizedComponent || reading.component;
      
      if (!groups[component]) {
        groups[component] = [];
      }
      groups[component].push(reading);
    }

    return groups;
  }

  /**
   * Classify a single component into one of the three categories
   */
  private classifyComponent(
    component: string,
    readings: IXrfReading[]
  ): {
    type: "AVERAGE" | "UNIFORM" | "NON_UNIFORM";
    summary: IAverageComponentSummary | IUniformComponentSummary | INonUniformComponentSummary;
  } {
    const total = readings.length;
    const positiveCount = readings.filter(r => r.isPositive).length;
    const negativeCount = total - positiveCount;
    const positivePct = (positiveCount / total) * 100;

    // RULE 1: ≥40 readings → Average Components Summary
    if (total >= STATISTICAL_SAMPLE_SIZE) {
      const result = positivePct > POSITIVE_PERCENT_THRESHOLD ? "POSITIVE" : "NEGATIVE";
      
      return {
        type: "AVERAGE",
        summary: {
          component,
          totalReadings: total,
          positiveCount,
          negativeCount,
          positivePercent: this.round(positivePct, 1),
          negativePercent: this.round(100 - positivePct, 1),
          result,
        } as IAverageComponentSummary,
      };
    }

    // RULE 2: <40 readings, ALL same result → Uniform Component Summary
    if (positiveCount === 0 || negativeCount === 0) {
      return {
        type: "UNIFORM",
        summary: {
          component,
          totalReadings: total,
          result: positiveCount > 0 ? "POSITIVE" : "NEGATIVE",
        } as IUniformComponentSummary,
      };
    }

    // RULE 3: <40 readings, MIXED results → Non-Uniform Component Summary
    return {
      type: "NON_UNIFORM",
      summary: {
        component,
        totalReadings: total,
        positiveCount,
        negativeCount,
        positivePercent: this.round(positivePct, 1),
        negativePercent: this.round(100 - positivePct, 1),
        readings: readings,
      } as INonUniformComponentSummary,
    };
  }

  /**
   * Calculate summary statistics for a dataset
   */
  calculateStats(summary: IDatasetSummary): ISummaryStats {
    return {
      totalReadings: summary.totalReadings,
      totalPositive: summary.totalPositive,
      totalNegative: summary.totalNegative,
      positivePercent: summary.totalReadings > 0
        ? this.round((summary.totalPositive / summary.totalReadings) * 100, 1)
        : 0,
      uniqueComponents: summary.uniqueComponents,
      averageComponentCount: summary.averageComponents.length,
      uniformComponentCount: summary.uniformComponents.length,
      nonUniformComponentCount: summary.nonUniformComponents.length,
    };
  }

  /**
   * Round number to specified decimal places
   */
  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Serialize job summary to JSON
   */
  toJson(summary: IJobSummary): string {
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Parse job summary from JSON
   */
  fromJson(json: string): IJobSummary {
    return JSON.parse(json) as IJobSummary;
  }
}
```

### 3. Create Unit Tests

Create `src/services/SummaryService.test.ts`:

```typescript
import { SummaryService } from "./SummaryService";
import { IXrfReading } from "../models/IXrfReading";
import { STATISTICAL_SAMPLE_SIZE, POSITIVE_PERCENT_THRESHOLD } from "../models/ISummary";

describe("SummaryService", () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
  });

  /**
   * Helper to create mock readings
   */
  function createReadings(
    component: string,
    count: number,
    positiveCount: number
  ): IXrfReading[] {
    const readings: IXrfReading[] = [];
    
    for (let i = 0; i < count; i++) {
      const isPositive = i < positiveCount;
      readings.push({
        readingId: `${component}-${i}`,
        component,
        normalizedComponent: component,
        color: "White",
        leadContent: isPositive ? 1.5 : 0.5,
        isPositive,
        location: "Test Location",
      });
    }
    
    return readings;
  }

  describe("classifyDataset", () => {
    it("should classify ≥40 readings as Average Component (POSITIVE when >2.5%)", () => {
      // 40 readings, 2 positive = 5% → POSITIVE (>2.5%)
      const readings = createReadings("Door Jamb", 40, 2);
      const result = service.classifyDataset(readings, "UNITS");

      expect(result.averageComponents).toHaveLength(1);
      expect(result.uniformComponents).toHaveLength(0);
      expect(result.nonUniformComponents).toHaveLength(0);
      
      expect(result.averageComponents[0].result).toBe("POSITIVE");
      expect(result.averageComponents[0].positivePercent).toBe(5.0);
    });

    it("should classify ≥40 readings as Average Component (NEGATIVE when ≤2.5%)", () => {
      // 40 readings, 1 positive = 2.5% → NEGATIVE (not > 2.5%)
      const readings = createReadings("Window Sill", 40, 1);
      const result = service.classifyDataset(readings, "UNITS");

      expect(result.averageComponents).toHaveLength(1);
      expect(result.averageComponents[0].result).toBe("NEGATIVE");
      expect(result.averageComponents[0].positivePercent).toBe(2.5);
    });

    it("should classify <40 all-negative readings as Uniform Component", () => {
      const readings = createReadings("Baseboard", 20, 0);
      const result = service.classifyDataset(readings, "COMMON_AREA");

      expect(result.averageComponents).toHaveLength(0);
      expect(result.uniformComponents).toHaveLength(1);
      expect(result.nonUniformComponents).toHaveLength(0);
      
      expect(result.uniformComponents[0].result).toBe("NEGATIVE");
      expect(result.uniformComponents[0].totalReadings).toBe(20);
    });

    it("should classify <40 all-positive readings as Uniform Component", () => {
      const readings = createReadings("Crown Molding", 15, 15);
      const result = service.classifyDataset(readings, "COMMON_AREA");

      expect(result.uniformComponents).toHaveLength(1);
      expect(result.uniformComponents[0].result).toBe("POSITIVE");
    });

    it("should classify <40 mixed readings as Non-Uniform Component", () => {
      const readings = createReadings("Wainscoting", 25, 5);
      const result = service.classifyDataset(readings, "UNITS");

      expect(result.averageComponents).toHaveLength(0);
      expect(result.uniformComponents).toHaveLength(0);
      expect(result.nonUniformComponents).toHaveLength(1);
      
      expect(result.nonUniformComponents[0].positiveCount).toBe(5);
      expect(result.nonUniformComponents[0].negativeCount).toBe(20);
      expect(result.nonUniformComponents[0].readings).toHaveLength(25);
    });

    it("should handle multiple components correctly", () => {
      const readings = [
        ...createReadings("Door Jamb", 50, 3),     // Average (6% positive)
        ...createReadings("Baseboard", 10, 0),    // Uniform (all negative)
        ...createReadings("Wall", 30, 5),         // Non-Uniform (mixed)
      ];

      const result = service.classifyDataset(readings, "UNITS");

      expect(result.averageComponents).toHaveLength(1);
      expect(result.uniformComponents).toHaveLength(1);
      expect(result.nonUniformComponents).toHaveLength(1);

      expect(result.averageComponents[0].component).toBe("Door Jamb");
      expect(result.uniformComponents[0].component).toBe("Baseboard");
      expect(result.nonUniformComponents[0].component).toBe("Wall");
    });

    it("should use normalizedComponent when available", () => {
      const readings: IXrfReading[] = [
        { readingId: "1", component: "door jamb", normalizedComponent: "Door Jamb", color: "W", leadContent: 0.5, isPositive: false, location: "" },
        { readingId: "2", component: "door-jamb", normalizedComponent: "Door Jamb", color: "W", leadContent: 0.5, isPositive: false, location: "" },
        { readingId: "3", component: "doorjamb", normalizedComponent: "Door Jamb", color: "W", leadContent: 0.5, isPositive: false, location: "" },
      ];

      const result = service.classifyDataset(readings, "UNITS");

      // All three should be grouped under "Door Jamb"
      expect(result.uniqueComponents).toBe(1);
      expect(result.uniformComponents[0].component).toBe("Door Jamb");
      expect(result.uniformComponents[0].totalReadings).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("should handle exactly 40 readings (threshold boundary)", () => {
      const readings39 = createReadings("Test39", 39, 5);
      const readings40 = createReadings("Test40", 40, 5);

      const result39 = service.classifyDataset(readings39, "UNITS");
      const result40 = service.classifyDataset(readings40, "UNITS");

      // 39 readings with mixed results → Non-Uniform
      expect(result39.nonUniformComponents).toHaveLength(1);
      expect(result39.averageComponents).toHaveLength(0);

      // 40 readings → Average
      expect(result40.averageComponents).toHaveLength(1);
      expect(result40.nonUniformComponents).toHaveLength(0);
    });

    it("should handle exactly 2.5% threshold", () => {
      // 40 readings, 1 positive = 2.5% exactly
      const readingsAt = createReadings("AtThreshold", 40, 1);
      // 40 readings, 2 positive = 5% (above threshold)
      const readingsAbove = createReadings("AboveThreshold", 40, 2);

      const resultAt = service.classifyDataset(readingsAt, "UNITS");
      const resultAbove = service.classifyDataset(readingsAbove, "UNITS");

      // 2.5% is NOT > 2.5%, so NEGATIVE
      expect(resultAt.averageComponents[0].result).toBe("NEGATIVE");
      // 5% > 2.5%, so POSITIVE
      expect(resultAbove.averageComponents[0].result).toBe("POSITIVE");
    });

    it("should handle empty readings array", () => {
      const result = service.classifyDataset([], "UNITS");

      expect(result.totalReadings).toBe(0);
      expect(result.uniqueComponents).toBe(0);
      expect(result.averageComponents).toHaveLength(0);
      expect(result.uniformComponents).toHaveLength(0);
      expect(result.nonUniformComponents).toHaveLength(0);
    });

    it("should handle single reading", () => {
      const readings = createReadings("Single", 1, 0);
      const result = service.classifyDataset(readings, "UNITS");

      expect(result.uniformComponents).toHaveLength(1);
      expect(result.uniformComponents[0].totalReadings).toBe(1);
    });
  });

  describe("generateJobSummary", () => {
    it("should generate complete job summary", () => {
      const commonArea = createReadings("Hallway Wall", 50, 3);
      const units = createReadings("Bedroom Door", 30, 0);

      const summary = service.generateJobSummary(
        "JOB-001",
        "test-file.xlsx",
        commonArea,
        units,
        5
      );

      expect(summary.jobNumber).toBe("JOB-001");
      expect(summary.sourceFileName).toBe("test-file.xlsx");
      expect(summary.aiNormalizationsApplied).toBe(5);
      expect(summary.commonAreaSummary).not.toBeNull();
      expect(summary.unitsSummary).not.toBeNull();
      expect(summary.commonAreaSummary?.datasetType).toBe("COMMON_AREA");
      expect(summary.unitsSummary?.datasetType).toBe("UNITS");
    });

    it("should handle null datasets", () => {
      const summary = service.generateJobSummary(
        "JOB-002",
        "test.xlsx",
        null,
        createReadings("Test", 10, 0),
        0
      );

      expect(summary.commonAreaSummary).toBeNull();
      expect(summary.unitsSummary).not.toBeNull();
    });
  });
});
```

---

## Acceptance Criteria

- [ ] Correctly classifies components with ≥40 readings as Average
- [ ] Correctly determines POSITIVE (>2.5%) vs NEGATIVE (≤2.5%) for Average components
- [ ] Correctly classifies <40 all-same as Uniform
- [ ] Correctly classifies <40 mixed as Non-Uniform
- [ ] Groups by normalizedComponent when available
- [ ] Handles edge cases (exactly 40, exactly 2.5%, empty, single)
- [ ] All unit tests pass

---

## Output Artifacts

```
src/
├── models/
│   └── ISummary.ts
├── services/
│   ├── SummaryService.ts
│   └── SummaryService.test.ts
```

---

## Classification Reference

| Readings | Positives | Positive % | Classification | Result |
|----------|-----------|------------|----------------|--------|
| 40+ | Any | >2.5% | Average | POSITIVE |
| 40+ | Any | ≤2.5% | Average | NEGATIVE |
| <40 | 0 | 0% | Uniform | NEGATIVE |
| <40 | All | 100% | Uniform | POSITIVE |
| <40 | Some | 0-100% | Non-Uniform | N/A |

---

## Next Steps

Once this building block is complete:
1. ➡️ Proceed to **BB-06: Azure OpenAI Integration**
2. AI normalization will group similar component names before summarization



