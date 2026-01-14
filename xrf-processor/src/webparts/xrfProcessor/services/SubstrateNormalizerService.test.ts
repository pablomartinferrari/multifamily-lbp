// Mock the factory imports to prevent SharePoint service loading
jest.mock('./ServiceFactory', () => ({
  getSharePointService: jest.fn(),
}));

jest.mock('./OpenAIService', () => ({
  getOpenAIService: jest.fn(),
  OpenAIService: jest.fn(),
}));

import { SubstrateNormalizerService } from './SubstrateNormalizerService';
import { IXrfReading, LEAD_POSITIVE_THRESHOLD } from '../models/IXrfReading';
import { ISubstrateCacheItem } from '../models/SharePointTypes';

// Mock the OpenAI and SharePoint services
const mockOpenAIService = {
  normalizeSubstrates: jest.fn(),
};

const mockSharePointService = {
  getCachedSubstrateMappings: jest.fn(),
  updateSubstrateCache: jest.fn(),
};

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

// Helper to create cache item
function createCacheItem(
  original: string,
  normalized: string,
  confidence: number = 0.95
): ISubstrateCacheItem {
  return {
    Id: 1,
    Title: original,
    NormalizedName: normalized,
    Confidence: confidence,
    Source: 'AI',
    UsageCount: 1,
    LastUsed: new Date().toISOString(),
  };
}

describe('SubstrateNormalizerService', () => {
  let service: SubstrateNormalizerService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSharePointService.getCachedSubstrateMappings.mockResolvedValue(new Map());
    mockSharePointService.updateSubstrateCache.mockResolvedValue(undefined);
    mockOpenAIService.normalizeSubstrates.mockResolvedValue({ normalizations: [] });
    service = new SubstrateNormalizerService(
      mockOpenAIService as any,
      mockSharePointService as any
    );
  });

  describe('Substrate Grouping', () => {
    it('should group wood variants together', async () => {
      mockOpenAIService.normalizeSubstrates.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Wood',
            variants: ['wood', 'wd', 'hardwood', 'softwood', 'plywood'],
            confidence: 0.95,
          },
        ],
      });

      const result = await service.normalizeSubstrates([
        'wood',
        'wd',
        'hardwood',
      ]);

      expect(result).toHaveLength(3);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Wood');
      });
    });

    it('should group metal variants together', async () => {
      mockOpenAIService.normalizeSubstrates.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Metal',
            variants: ['metal', 'mtl', 'steel', 'iron', 'aluminum'],
            confidence: 0.92,
          },
        ],
      });

      const result = await service.normalizeSubstrates([
        'metal',
        'steel',
        'aluminum',
      ]);

      expect(result).toHaveLength(3);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Metal');
      });
    });

    it('should group drywall variants together', async () => {
      mockOpenAIService.normalizeSubstrates.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Drywall',
            variants: ['drywall', 'dry wall', 'sheetrock', 'gypsum', 'wallboard'],
            confidence: 0.90,
          },
        ],
      });

      const result = await service.normalizeSubstrates([
        'drywall',
        'sheetrock',
        'gypsum',
      ]);

      expect(result).toHaveLength(3);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Drywall');
      });
    });
  });

  describe('Cache Integration', () => {
    it('should use cached mappings when available', async () => {
      // Setup cache with existing mapping
      const cachedMappings = new Map<string, ISubstrateCacheItem>([
        ['wood', createCacheItem('wood', 'Wood', 0.95)],
      ]);
      mockSharePointService.getCachedSubstrateMappings.mockResolvedValue(cachedMappings);

      const result = await service.normalizeSubstrates(['wood', 'metal']);

      // wood should come from cache
      const wood = result.find(r => r.originalName === 'wood');
      expect(wood?.source).toBe('CACHE');
      expect(wood?.normalizedName).toBe('Wood');

      // AI should only be called for uncached items
      expect(mockOpenAIService.normalizeSubstrates).toHaveBeenCalledWith(['metal']);
    });

    it('should save new AI normalizations to cache', async () => {
      mockOpenAIService.normalizeSubstrates.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Wood',
            variants: ['plywood'],
            confidence: 0.88,
          },
        ],
      });

      await service.normalizeSubstrates(['plywood']);

      expect(mockSharePointService.updateSubstrateCache).toHaveBeenCalled();
      const savedMappings = mockSharePointService.updateSubstrateCache.mock.calls[0][0];
      expect(savedMappings).toHaveLength(1);
      expect(savedMappings[0].normalizedName).toBe('Wood');
    });
  });

  describe('normalizeReadings', () => {
    it('should normalize substrate names in readings', async () => {
      mockOpenAIService.normalizeSubstrates.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Wood',
            variants: ['wd', 'wood'],
            confidence: 0.95,
          },
        ],
      });

      const readings = [
        createReading('Door', 0.5, { substrate: 'wd' }),
        createReading('Window', 0.3, { substrate: 'wood' }),
      ];

      const { readings: normalizedReadings, aiNormalizationsCount } = await service.normalizeReadings(readings);

      expect(normalizedReadings[0].normalizedSubstrate).toBe('Wood');
      expect(normalizedReadings[1].normalizedSubstrate).toBe('Wood');
      expect(aiNormalizationsCount).toBe(2);
    });

    it('should handle readings without substrate', async () => {
      const readings = [
        createReading('Door', 0.5), // No substrate
        createReading('Window', 0.3), // No substrate
      ];

      const { readings: normalizedReadings, aiNormalizationsCount } = await service.normalizeReadings(readings);

      expect(normalizedReadings[0].normalizedSubstrate).toBeUndefined();
      expect(normalizedReadings[1].normalizedSubstrate).toBeUndefined();
      expect(aiNormalizationsCount).toBe(0);
    });

    it('should handle mixed readings with and without substrate', async () => {
      mockOpenAIService.normalizeSubstrates.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Metal',
            variants: ['mtl'],
            confidence: 0.95,
          },
        ],
      });

      const readings = [
        createReading('Door', 0.5, { substrate: 'mtl' }),
        createReading('Window', 0.3), // No substrate
      ];

      const { readings: normalizedReadings } = await service.normalizeReadings(readings);

      expect(normalizedReadings[0].normalizedSubstrate).toBe('Metal');
      expect(normalizedReadings[1].normalizedSubstrate).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty substrate array', async () => {
      const result = await service.normalizeSubstrates([]);
      expect(result).toHaveLength(0);
      expect(mockOpenAIService.normalizeSubstrates).not.toHaveBeenCalled();
    });

    it('should deduplicate substrate names', async () => {
      mockOpenAIService.normalizeSubstrates.mockResolvedValue({
        normalizations: [
          { canonical: 'Wood', variants: ['wood'], confidence: 0.95 },
        ],
      });

      await service.normalizeSubstrates(['wood', 'WOOD', 'Wood']);

      // Should only call AI with one unique name
      expect(mockOpenAIService.normalizeSubstrates).toHaveBeenCalledWith(['wood']);
    });

    it('should fall back to title case when AI fails', async () => {
      mockOpenAIService.normalizeSubstrates.mockRejectedValue(new Error('API error'));

      const result = await service.normalizeSubstrates(['unknown material']);

      expect(result).toHaveLength(1);
      expect(result[0].normalizedName).toBe('Unknown Material');
      expect(result[0].confidence).toBe(0.5);
    });

    it('should title case names not explicitly returned by AI', async () => {
      mockOpenAIService.normalizeSubstrates.mockResolvedValue({
        normalizations: [], // AI returns empty - didn't group anything
      });

      const result = await service.normalizeSubstrates(['some weird substrate']);

      expect(result).toHaveLength(1);
      expect(result[0].normalizedName).toBe('Some Weird Substrate');
    });
  });
});
