/// <reference types="jest" />

// Mock fetch before imports
const mockFetch = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = mockFetch;

import { AIColumnMapperService, IAIColumnMapping } from './AIColumnMapperService';
import { IOpenAIConfig } from '../config/OpenAIConfig';

describe('AIColumnMapperService', () => {
  let service: AIColumnMapperService;
  const testConfig: IOpenAIConfig = {
    provider: 'openai',
    apiKey: 'test-api-key',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 2000,
    openaiBaseUrl: 'https://api.openai.com/v1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AIColumnMapperService(testConfig);
  });

  describe('isConfigured', () => {
    it('should return true when API key is set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when API key is empty', () => {
      const unconfiguredService = new AIColumnMapperService({
        ...testConfig,
        apiKey: '',
      });
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('mapColumns', () => {
    const mockAIResponse = {
      mappings: [
        { field: 'readingId', column: 'Test #', confidence: 0.95 },
        { field: 'component', column: 'Element', confidence: 0.92 },
        { field: 'color', column: 'Paint Color', confidence: 0.98 },
        { field: 'leadContent', column: 'Pb (mg/cm²)', confidence: 0.99 },
        { field: 'location', column: 'Room', confidence: 0.90 },
      ],
      unmapped: ['Notes', 'Operator'],
      overallConfidence: 0.94,
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockAIResponse),
              },
            },
          ],
        }),
      });
    });

    it('should map standard XRF columns correctly', async () => {
      const headers = ['Test #', 'Element', 'Paint Color', 'Pb (mg/cm²)', 'Room', 'Notes', 'Operator'];

      const result = await service.mapColumns(headers);

      expect(result.readingId).toBe('Test #');
      expect(result.component).toBe('Element');
      expect(result.color).toBe('Paint Color');
      expect(result.leadContent).toBe('Pb (mg/cm²)');
      expect(result.location).toBe('Room');
      expect(result.unmapped).toContain('Notes');
      expect(result.unmapped).toContain('Operator');
      expect(result.confidence).toBe(0.94);
    });

    it('should include sample data in the prompt when provided', async () => {
      const headers = ['Test #', 'Element', 'Pb'];
      const sampleData = [
        { 'Test #': '001', 'Element': 'Door Jamb', 'Pb': 1.5 },
        { 'Test #': '002', 'Element': 'Window Sill', 'Pb': 0.3 },
      ];

      await service.mapColumns(headers, sampleData);

      // Check that fetch was called with the sample data in the prompt
      const fetchCall = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const userMessage = requestBody.messages.find((m: { role: string }) => m.role === 'user');
      
      expect(userMessage.content).toContain('Sample data');
      expect(userMessage.content).toContain('Door Jamb');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(service.mapColumns(['Header1', 'Header2'])).rejects.toThrow(
        'OpenAI API error: 401 - Unauthorized'
      );
    });

    it('should throw when not configured', async () => {
      const unconfiguredService = new AIColumnMapperService({
        ...testConfig,
        apiKey: '',
      });

      await expect(unconfiguredService.mapColumns(['Header1'])).rejects.toThrow(
        'AI Column Mapper is not configured'
      );
    });

    it('should handle markdown code blocks in AI response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n' + JSON.stringify(mockAIResponse) + '\n```',
              },
            },
          ],
        }),
      });

      const result = await service.mapColumns(['Test #', 'Element', 'Pb (mg/cm²)']);

      expect(result.readingId).toBe('Test #');
      expect(result.confidence).toBe(0.94);
    });
  });

  describe('mapColumns - Different XRF Machine Formats', () => {
    it('should map Niton XRF format', async () => {
      const nitonResponse = {
        mappings: [
          { field: 'readingId', column: 'Reading', confidence: 0.95 },
          { field: 'component', column: 'Matrix', confidence: 0.88 },
          { field: 'leadContent', column: 'Pb Conc', confidence: 0.97 },
          { field: 'color', column: 'Color', confidence: 0.99 },
          { field: 'location', column: 'Location ID', confidence: 0.92 },
        ],
        unmapped: ['Serial', 'Date', 'Time'],
        overallConfidence: 0.94,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(nitonResponse) } }],
        }),
      });

      const headers = ['Reading', 'Matrix', 'Pb Conc', 'Color', 'Location ID', 'Serial', 'Date', 'Time'];
      const result = await service.mapColumns(headers);

      expect(result.readingId).toBe('Reading');
      expect(result.component).toBe('Matrix');
      expect(result.leadContent).toBe('Pb Conc');
    });

    it('should map Viken XRF format', async () => {
      const vikenResponse = {
        mappings: [
          { field: 'readingId', column: 'Sample ID', confidence: 0.96 },
          { field: 'component', column: 'Substrate Component', confidence: 0.94 },
          { field: 'leadContent', column: 'Result (mg/cm2)', confidence: 0.98 },
          { field: 'color', column: 'Coating Color', confidence: 0.97 },
          { field: 'location', column: 'Room/Unit', confidence: 0.93 },
          { field: 'result', column: 'Classification', confidence: 0.95 },
        ],
        unmapped: ['Inspector', 'Calibration'],
        overallConfidence: 0.95,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(vikenResponse) } }],
        }),
      });

      const headers = ['Sample ID', 'Substrate Component', 'Result (mg/cm2)', 'Coating Color', 'Room/Unit', 'Classification', 'Inspector', 'Calibration'];
      const result = await service.mapColumns(headers);

      expect(result.readingId).toBe('Sample ID');
      expect(result.component).toBe('Substrate Component');
      expect(result.leadContent).toBe('Result (mg/cm2)');
      expect(result.result).toBe('Classification');
    });

    it('should map generic/custom format with unusual column names', async () => {
      const customResponse = {
        mappings: [
          { field: 'readingId', column: 'Rdg #', confidence: 0.90 },
          { field: 'component', column: 'Item Tested', confidence: 0.85 },
          { field: 'leadContent', column: 'PbC', confidence: 0.93 },
          { field: 'color', column: 'Colour', confidence: 0.99 },
          { field: 'location', column: 'Apt/Space', confidence: 0.88 },
        ],
        unmapped: ['Tech Initials', 'Weather'],
        overallConfidence: 0.91,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(customResponse) } }],
        }),
      });

      const headers = ['Rdg #', 'Item Tested', 'PbC', 'Colour', 'Apt/Space', 'Tech Initials', 'Weather'];
      const result = await service.mapColumns(headers);

      expect(result.readingId).toBe('Rdg #');
      expect(result.component).toBe('Item Tested');
      expect(result.leadContent).toBe('PbC');
      expect(result.color).toBe('Colour'); // British spelling
    });
  });

  describe('validateMapping', () => {
    it('should return valid when all required fields are present', () => {
      const mapping: IAIColumnMapping = {
        readingId: 'Test #',
        component: 'Element',
        leadContent: 'Pb',
        color: 'Color',
        unmapped: [],
        confidence: 0.95,
      };

      const validation = service.validateMapping(mapping);

      expect(validation.isValid).toBe(true);
      expect(validation.missingRequired).toHaveLength(0);
    });

    it('should return invalid when required fields are missing', () => {
      const mapping: IAIColumnMapping = {
        readingId: 'Test #',
        // component missing
        leadContent: 'Pb',
        unmapped: [],
        confidence: 0.85,
      };

      const validation = service.validateMapping(mapping);

      expect(validation.isValid).toBe(false);
      expect(validation.missingRequired).toContain('component');
    });

    it('should warn when color is missing', () => {
      const mapping: IAIColumnMapping = {
        readingId: 'Test #',
        component: 'Element',
        leadContent: 'Pb',
        // color missing
        unmapped: [],
        confidence: 0.95,
      };

      const validation = service.validateMapping(mapping);

      expect(validation.isValid).toBe(true); // Still valid
      expect(validation.warnings).toContain("color column not found - will default to 'Unknown'");
    });

    it('should warn when confidence is low', () => {
      const mapping: IAIColumnMapping = {
        readingId: 'Test #',
        component: 'Element',
        leadContent: 'Pb',
        color: 'Color',
        unmapped: [],
        confidence: 0.65, // Below 0.7 threshold
      };

      const validation = service.validateMapping(mapping);

      expect(validation.warnings.some(w => w.includes('Low confidence'))).toBe(true);
    });
  });

  describe('Azure OpenAI Support', () => {
    it('should use Azure endpoint when provider is azure', async () => {
      const azureConfig: IOpenAIConfig = {
        provider: 'azure',
        apiKey: 'azure-api-key',
        model: 'gpt-4o-deployment',
        temperature: 0.3,
        maxTokens: 2000,
        azureEndpoint: 'https://myresource.openai.azure.com',
        azureApiVersion: '2024-02-15-preview',
      };

      const azureService = new AIColumnMapperService(azureConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  mappings: [{ field: 'readingId', column: 'Test', confidence: 0.95 }],
                  unmapped: [],
                  overallConfidence: 0.95,
                }),
              },
            },
          ],
        }),
      });

      await azureService.mapColumns(['Test']);

      // Verify Azure endpoint was called
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('myresource.openai.azure.com');
      expect(fetchCall[0]).toContain('gpt-4o-deployment');
      expect(fetchCall[1].headers['api-key']).toBe('azure-api-key');
    });
  });
});
