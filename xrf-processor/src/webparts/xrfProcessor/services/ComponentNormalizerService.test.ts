// Mock @pnp/sp modules BEFORE imports
jest.mock('@pnp/sp', () => ({
  SPFI: jest.fn(),
  spfi: jest.fn(),
}));
jest.mock('@pnp/sp/webs', () => ({}));
jest.mock('@pnp/sp/lists', () => ({}));
jest.mock('@pnp/sp/items', () => ({}));
jest.mock('@pnp/sp/files', () => ({}));
jest.mock('@pnp/sp/folders', () => ({}));

// Mock the service factory to prevent initialization issues
jest.mock('./ServiceFactory', () => ({
  getSharePointService: jest.fn(),
}));

// Mock OpenAIService factory
jest.mock('./OpenAIService', () => {
  const mockClass = jest.fn().mockImplementation(() => ({
    normalizeComponents: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true),
  }));
  return {
    OpenAIService: mockClass,
    getOpenAIService: jest.fn(() => new mockClass()),
  };
});

import { ComponentNormalizerService } from './ComponentNormalizerService';
import { IXrfReading } from '../models/IXrfReading';
import { IComponentCacheItem } from '../models/SharePointTypes';

// Helper to create cache item
function createCacheItem(original: string, normalized: string, confidence = 0.95): IComponentCacheItem {
  return {
    Id: Math.floor(Math.random() * 1000),
    Title: original,
    NormalizedName: normalized,
    Confidence: confidence,
    Source: 'AI',
    UsageCount: 1,
    LastUsed: new Date().toISOString(),
  };
}

// Helper to create mock readings
function createReading(component: string, leadContent = 0.5): IXrfReading {
  return {
    readingId: `R-${Math.random().toString(36).substr(2, 9)}`,
    component,
    color: 'White',
    leadContent,
    isPositive: leadContent >= 1.0,
    location: 'Unit 101',
  };
}

// Mock types
interface MockOpenAIService {
  normalizeComponents: jest.Mock;
  isConfigured: jest.Mock;
}

interface MockSharePointService {
  getCachedMappings: jest.Mock;
  updateComponentCache: jest.Mock;
}

describe('ComponentNormalizerService', () => {
  let service: ComponentNormalizerService;
  let mockOpenAIService: MockOpenAIService;
  let mockSharePointService: MockSharePointService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockOpenAIService = {
      normalizeComponents: jest.fn(),
      isConfigured: jest.fn().mockReturnValue(true),
    };
    
    mockSharePointService = {
      getCachedMappings: jest.fn(),
      updateComponentCache: jest.fn(),
    };

    // Default mock implementations
    mockSharePointService.getCachedMappings.mockResolvedValue(new Map());
    mockSharePointService.updateComponentCache.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ComponentNormalizerService(mockOpenAIService as any, mockSharePointService as any);
  });

  describe('Synonym Grouping', () => {
    it('should group wainscoting and wainscot together', async () => {
      // AI groups these as the same component
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Wainscoting',
            variants: ['wainscoting', 'wainscot'],
            confidence: 0.95,
          },
        ],
      });

      const result = await service.normalizeComponents(['wainscoting', 'wainscot']);

      expect(result).toHaveLength(2);
      expect(result.find(r => r.originalName === 'wainscoting')?.normalizedName).toBe('Wainscoting');
      expect(result.find(r => r.originalName === 'wainscot')?.normalizedName).toBe('Wainscoting');
    });

    it('should keep sheathing separate from wainscoting', async () => {
      // AI correctly identifies these as different components
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Wainscoting',
            variants: ['wainscoting', 'wainscot'],
            confidence: 0.95,
          },
          {
            canonical: 'Sheathing',
            variants: ['sheathing'],
            confidence: 0.98,
          },
        ],
      });

      const result = await service.normalizeComponents(['wainscoting', 'wainscot', 'sheathing']);

      expect(result).toHaveLength(3);
      expect(result.find(r => r.originalName === 'wainscoting')?.normalizedName).toBe('Wainscoting');
      expect(result.find(r => r.originalName === 'wainscot')?.normalizedName).toBe('Wainscoting');
      expect(result.find(r => r.originalName === 'sheathing')?.normalizedName).toBe('Sheathing');
    });

    it('should group door jamb variations', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Door Jamb',
            variants: ['door jamb', 'door-jamb', 'doorjamb', 'd/j', 'door jam'],
            confidence: 0.92,
          },
        ],
      });

      const result = await service.normalizeComponents([
        'door jamb',
        'door-jamb',
        'doorjamb',
        'd/j',
        'door jam', // common typo
      ]);

      expect(result).toHaveLength(5);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Door Jamb');
      });
    });

    it('should group baseboard synonyms', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Baseboard',
            variants: ['baseboard', 'base board', 'base molding', 'base moulding', 'skirting'],
            confidence: 0.90,
          },
        ],
      });

      const result = await service.normalizeComponents([
        'baseboard',
        'base board',
        'base molding',
        'base moulding',
        'skirting',
      ]);

      expect(result).toHaveLength(5);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Baseboard');
      });
    });

    it('should group window sill variations and abbreviations', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Window Sill',
            variants: ['window sill', 'windowsill', 'w/s', 'win sill', 'window cill'],
            confidence: 0.93,
          },
        ],
      });

      const result = await service.normalizeComponents([
        'window sill',
        'windowsill',
        'w/s',
        'win sill',
        'window cill', // British spelling
      ]);

      expect(result).toHaveLength(5);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Window Sill');
      });
    });

    it('should handle case insensitivity', async () => {
      // Service deduplicates by lowercasing first, so all variants become 'door frame'
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Door Frame',
            variants: ['door frame'],
            confidence: 0.98,
          },
        ],
      });

      const result = await service.normalizeComponents([
        'DOOR FRAME',
        'door frame',
        'Door Frame',
      ]);

      // Should be 1 result (deduplicated)
      expect(result).toHaveLength(1);
      expect(result[0].normalizedName).toBe('Door Frame');
      // Original name is stored in lowercase
      expect(result[0].originalName).toBe('door frame');
    });

    it('should handle trim/molding/casing synonyms', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Window Trim',
            variants: ['window trim', 'window casing', 'window molding', 'window moulding'],
            confidence: 0.88,
          },
        ],
      });

      const result = await service.normalizeComponents([
        'window trim',
        'window casing',
        'window molding',
      ]);

      expect(result).toHaveLength(3);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Window Trim');
      });
    });
  });

  describe('Cache Integration', () => {
    it('should use cached mappings when available', async () => {
      // Setup cache with existing mapping
      const cachedMappings = new Map<string, IComponentCacheItem>([
        ['door jamb', createCacheItem('door jamb', 'Door Jamb', 0.95)],
      ]);
      mockSharePointService.getCachedMappings.mockResolvedValue(cachedMappings);

      const result = await service.normalizeComponents(['door jamb', 'window sill']);

      // door jamb should come from cache
      const doorJamb = result.find(r => r.originalName === 'door jamb');
      expect(doorJamb?.source).toBe('CACHE');
      expect(doorJamb?.normalizedName).toBe('Door Jamb');

      // AI should only be called for uncached items
      expect(mockOpenAIService.normalizeComponents).toHaveBeenCalledWith(['window sill']);
    });

    it('should save new AI normalizations to cache', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Door Jamb',
            variants: ['door jamb'],
            confidence: 0.95,
          },
        ],
      });

      await service.normalizeComponents(['door jamb']);

      expect(mockSharePointService.updateComponentCache).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            originalName: 'door jamb',
            normalizedName: 'Door Jamb',
            source: 'AI',
          }),
        ])
      );
    });

    it('should not call AI when all components are cached', async () => {
      const cachedMappings = new Map<string, IComponentCacheItem>([
        ['door jamb', createCacheItem('door jamb', 'Door Jamb', 0.95)],
        ['window sill', createCacheItem('window sill', 'Window Sill', 0.93)],
      ]);
      mockSharePointService.getCachedMappings.mockResolvedValue(cachedMappings);

      const result = await service.normalizeComponents(['door jamb', 'window sill']);

      expect(mockOpenAIService.normalizeComponents).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result.every(r => r.source === 'CACHE')).toBe(true);
    });
  });

  describe('normalizeReadings', () => {
    it('should apply normalizations to readings', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Door Jamb',
            variants: ['door jamb', 'd/j'],
            confidence: 0.95,
          },
          {
            canonical: 'Window Sill',
            variants: ['window sill', 'w/s'],
            confidence: 0.93,
          },
        ],
      });

      const readings = [
        createReading('door jamb'),
        createReading('d/j'),
        createReading('window sill'),
        createReading('w/s'),
      ];

      const result = await service.normalizeReadings(readings);

      expect(result.readings).toHaveLength(4);
      expect(result.readings[0].normalizedComponent).toBe('Door Jamb');
      expect(result.readings[1].normalizedComponent).toBe('Door Jamb');
      expect(result.readings[2].normalizedComponent).toBe('Window Sill');
      expect(result.readings[3].normalizedComponent).toBe('Window Sill');
    });

    it('should count AI normalizations correctly', async () => {
      // One from cache, one from AI
      const cachedMappings = new Map<string, IComponentCacheItem>([
        ['door jamb', createCacheItem('door jamb', 'Door Jamb', 0.95)],
      ]);
      mockSharePointService.getCachedMappings.mockResolvedValue(cachedMappings);

      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Window Sill',
            variants: ['window sill'],
            confidence: 0.93,
          },
        ],
      });

      const readings = [
        createReading('door jamb'),
        createReading('window sill'),
      ];

      const result = await service.normalizeReadings(readings);

      expect(result.aiNormalizationsCount).toBe(1); // Only window sill is from AI
    });

    it('should preserve original component when normalization not found', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [], // AI returns nothing
      });

      const readings = [createReading('unknown component')];

      const result = await service.normalizeReadings(readings);

      // Should fall back to title case
      expect(result.readings[0].normalizedComponent).toBe('Unknown Component');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', async () => {
      const result = await service.normalizeComponents([]);

      expect(result).toHaveLength(0);
      expect(mockOpenAIService.normalizeComponents).not.toHaveBeenCalled();
    });

    it('should deduplicate component names', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Door Jamb',
            variants: ['door jamb'],
            confidence: 0.95,
          },
        ],
      });

      // Same component appearing multiple times
      await service.normalizeComponents(['door jamb', 'Door Jamb', 'DOOR JAMB']);

      // AI should only be called with unique lowercase names
      expect(mockOpenAIService.normalizeComponents).toHaveBeenCalledWith(['door jamb']);
    });

    it('should handle AI service failure gracefully', async () => {
      mockOpenAIService.normalizeComponents.mockRejectedValue(new Error('API Error'));

      const result = await service.normalizeComponents(['door jamb']);

      // Should fall back to title case
      expect(result).toHaveLength(1);
      expect(result[0].normalizedName).toBe('Door Jamb');
      expect(result[0].confidence).toBe(0.5); // Lower confidence for fallback
    });

    it('should handle cache save failure gracefully', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Door Jamb',
            variants: ['door jamb'],
            confidence: 0.95,
          },
        ],
      });
      mockSharePointService.updateComponentCache.mockRejectedValue(new Error('Cache Error'));

      // Should not throw, just log warning
      const result = await service.normalizeComponents(['door jamb']);

      expect(result).toHaveLength(1);
      expect(result[0].normalizedName).toBe('Door Jamb');
    });

    it('should trim whitespace from component names', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Door Jamb',
            variants: ['door jamb'],
            confidence: 0.95,
          },
        ],
      });

      await service.normalizeComponents(['  door jamb  ', 'door jamb']);

      // Should be deduplicated after trimming
      expect(mockOpenAIService.normalizeComponents).toHaveBeenCalledWith(['door jamb']);
    });

    it('should filter out empty component names', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [],
      });

      await service.normalizeComponents(['', '   ', 'door jamb']);

      // Empty strings should be filtered out
      expect(mockOpenAIService.normalizeComponents).toHaveBeenCalledWith(['door jamb']);
    });
  });

  describe('Construction-Specific Synonyms', () => {
    it('should handle mullion vs muntin correctly', async () => {
      // These are actually different (mullion = vertical divider, muntin = grid divider)
      // but often confused - AI should ideally keep them separate
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Window Mullion',
            variants: ['mullion', 'window mullion'],
            confidence: 0.90,
          },
          {
            canonical: 'Window Muntin',
            variants: ['muntin', 'window muntin', 'muntin bar'],
            confidence: 0.90,
          },
        ],
      });

      const result = await service.normalizeComponents(['mullion', 'muntin']);

      expect(result.find(r => r.originalName === 'mullion')?.normalizedName).toBe('Window Mullion');
      expect(result.find(r => r.originalName === 'muntin')?.normalizedName).toBe('Window Muntin');
    });

    it('should group newel post variations', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Newel Post',
            variants: ['newel', 'newel post', 'newell', 'newell post'],
            confidence: 0.92,
          },
        ],
      });

      const result = await service.normalizeComponents(['newel', 'newel post', 'newell']);

      expect(result).toHaveLength(3);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Newel Post');
      });
    });

    it('should group stair components correctly', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Stair Riser',
            variants: ['riser', 'stair riser', 'staircase riser'],
            confidence: 0.93,
          },
          {
            canonical: 'Stair Tread',
            variants: ['tread', 'stair tread', 'step tread'],
            confidence: 0.93,
          },
          {
            canonical: 'Stair Stringer',
            variants: ['stringer', 'stair stringer', 'carriage'],
            confidence: 0.88,
          },
        ],
      });

      const result = await service.normalizeComponents(['riser', 'tread', 'stringer']);

      expect(result.find(r => r.originalName === 'riser')?.normalizedName).toBe('Stair Riser');
      expect(result.find(r => r.originalName === 'tread')?.normalizedName).toBe('Stair Tread');
      expect(result.find(r => r.originalName === 'stringer')?.normalizedName).toBe('Stair Stringer');
    });
  });

  describe('Abbreviation Expansion', () => {
    it('should group "clos. wall" and "closet wall" to same canonical form', async () => {
      // AI should recognize that "clos." is an abbreviation for "closet"
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Closet Wall',
            variants: ['clos. wall', 'closet wall', 'clos wall'],
            confidence: 0.95,
          },
        ],
      });

      const result = await service.normalizeComponents([
        'clos. wall',
        'closet wall',
        'clos wall',
      ]);

      // All three different names should normalize to the same canonical form
      expect(result).toHaveLength(3);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Closet Wall');
      });
    });

    it('should expand "dr. jamb" to "Door Jamb"', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Door Jamb',
            variants: ['dr. jamb', 'dr jamb', 'door jamb', 'doorjamb'],
            confidence: 0.95,
          },
        ],
      });

      const result = await service.normalizeComponents(['dr. jamb', 'door jamb']);

      expect(result).toHaveLength(2);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Door Jamb');
      });
    });

    it('should expand "kit. cab" to "Kitchen Cabinet"', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Kitchen Cabinet',
            variants: ['kit. cab', 'kit cab', 'kitchen cabinet', 'kitch cabinet'],
            confidence: 0.95,
          },
        ],
      });

      const result = await service.normalizeComponents(['kit. cab', 'kitchen cabinet']);

      expect(result).toHaveLength(2);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Kitchen Cabinet');
      });
    });

    it('should expand "win. sill" to "Window Sill"', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Window Sill',
            variants: ['win. sill', 'win sill', 'window sill', 'wndw sill', 'W/S'],
            confidence: 0.95,
          },
        ],
      });

      const result = await service.normalizeComponents(['win. sill', 'window sill', 'W/S']);

      expect(result).toHaveLength(3);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Window Sill');
      });
    });

    it('should handle mixed abbreviations and full words in same component', async () => {
      mockOpenAIService.normalizeComponents.mockResolvedValue({
        normalizations: [
          {
            canonical: 'Bedroom Door Frame',
            variants: ['brm dr frame', 'bedroom door frame', 'bdrm door frame'],
            confidence: 0.90,
          },
        ],
      });

      const result = await service.normalizeComponents([
        'brm dr frame',
        'bedroom door frame',
      ]);

      expect(result).toHaveLength(2);
      result.forEach(r => {
        expect(r.normalizedName).toBe('Bedroom Door Frame');
      });
    });
  });
});
