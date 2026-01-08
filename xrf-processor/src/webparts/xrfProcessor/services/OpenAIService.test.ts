import { OpenAIService, initializeOpenAIService, getOpenAIService } from './OpenAIService';
import { DEFAULT_OPENAI_CONFIG } from '../config/OpenAIConfig';

// Mock fetch globally
const mockFetch = jest.fn();
(global as unknown as { fetch: typeof fetch }).fetch = mockFetch;

// Helper to create mock API response
function createMockResponse(content: string, status = 200): Response {
  const body = {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function createErrorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: { message } }),
    text: async () => JSON.stringify({ error: { message } }),
  } as Response;
}

describe('OpenAIService', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Constructor and Configuration', () => {
    it('should use default config when no config provided', () => {
      const service = new OpenAIService();
      const config = service.getConfig();

      expect(config.provider).toBe(DEFAULT_OPENAI_CONFIG.provider);
      expect(config.model).toBe(DEFAULT_OPENAI_CONFIG.model);
      expect(config.temperature).toBe(DEFAULT_OPENAI_CONFIG.temperature);
      expect(config.maxTokens).toBe(DEFAULT_OPENAI_CONFIG.maxTokens);
    });

    it('should merge provided config with defaults', () => {
      const service = new OpenAIService({
        apiKey: 'sk-test-key',
        temperature: 0.5,
      });
      const config = service.getConfig();

      expect(config.apiKey).toBe('sk-test-key');
      expect(config.temperature).toBe(0.5);
      expect(config.model).toBe(DEFAULT_OPENAI_CONFIG.model); // Default preserved
    });

    it('should update config via setConfig', () => {
      const service = new OpenAIService();
      service.setConfig({ apiKey: 'sk-new-key' });

      expect(service.getConfig().apiKey).toBe('sk-new-key');
    });

    it('should return provider via getProvider', () => {
      const service = new OpenAIService({ provider: 'azure' });
      expect(service.getProvider()).toBe('azure');
    });
  });

  describe('isConfigured', () => {
    it('should return false when no API key is set', () => {
      const service = new OpenAIService();
      expect(service.isConfigured()).toBe(false);
    });

    it('should return true for OpenAI with valid sk- key', () => {
      const service = new OpenAIService({
        provider: 'openai',
        apiKey: 'sk-test-key',
      });
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false for OpenAI with invalid key format', () => {
      const service = new OpenAIService({
        provider: 'openai',
        apiKey: 'invalid-key', // Doesn't start with sk-
      });
      expect(service.isConfigured()).toBe(false);
    });

    it('should return true for Azure with endpoint and model', () => {
      const service = new OpenAIService({
        provider: 'azure',
        apiKey: 'azure-api-key',
        azureEndpoint: 'https://myresource.openai.azure.com',
        model: 'my-deployment',
      });
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false for Azure without endpoint', () => {
      const service = new OpenAIService({
        provider: 'azure',
        apiKey: 'azure-api-key',
        model: 'my-deployment',
      });
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('normalizeComponents', () => {
    it('should return empty result for empty input', async () => {
      const service = new OpenAIService({ apiKey: 'sk-test-key' });
      const result = await service.normalizeComponents([]);

      expect(result.normalizations).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw error when not configured', async () => {
      const service = new OpenAIService();

      await expect(service.normalizeComponents(['door frame'])).rejects.toThrow(
        'OpenAI API key not configured'
      );
    });

    it('should throw Azure-specific error when Azure not configured', async () => {
      const service = new OpenAIService({
        provider: 'azure',
        apiKey: 'key',
      });

      await expect(service.normalizeComponents(['door frame'])).rejects.toThrow(
        'Azure OpenAI not configured'
      );
    });

    it('should call OpenAI API with correct format', async () => {
      const mockResponse = createMockResponse(JSON.stringify({
        normalizations: [
          { canonical: 'Door Frame', variants: ['door frame'], confidence: 0.95 },
        ],
      }));
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4o-mini',
      });

      await service.normalizeComponents(['door frame']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer sk-test-key');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toContain('door frame');
    });

    it('should call Azure API with correct format', async () => {
      const mockResponse = createMockResponse(JSON.stringify({
        normalizations: [
          { canonical: 'Door Frame', variants: ['door frame'], confidence: 0.95 },
        ],
      }));
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({
        provider: 'azure',
        apiKey: 'azure-key',
        azureEndpoint: 'https://myresource.openai.azure.com',
        model: 'gpt-4-deployment',
        azureApiVersion: '2024-02-15-preview',
      });

      await service.normalizeComponents(['door frame']);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toContain('https://myresource.openai.azure.com/openai/deployments/gpt-4-deployment/chat/completions');
      expect(url).toContain('api-version=2024-02-15-preview');
      expect(options.headers['api-key']).toBe('azure-key');
    });

    it('should parse JSON response correctly', async () => {
      const mockResponse = createMockResponse(JSON.stringify({
        normalizations: [
          { canonical: 'Door Frame', variants: ['door jamb', 'door frame'], confidence: 0.92 },
          { canonical: 'Window Sill', variants: ['window sil', 'windowsill'], confidence: 0.88 },
        ],
      }));
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({
        apiKey: 'sk-test-key',
      });

      const result = await service.normalizeComponents(['door jamb', 'window sil']);

      expect(result.normalizations).toHaveLength(2);
      expect(result.normalizations[0].canonical).toBe('Door Frame');
      expect(result.normalizations[0].variants).toContain('door jamb');
      expect(result.normalizations[0].confidence).toBe(0.92);
    });

    it('should parse JSON from markdown code block', async () => {
      const responseWithMarkdown = '```json\n{"normalizations": [{"canonical": "Test Component", "variants": ["test"], "confidence": 0.9}]}\n```';
      const mockResponse = createMockResponse(responseWithMarkdown);
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({ apiKey: 'sk-test-key' });
      const result = await service.normalizeComponents(['test']);

      expect(result.normalizations).toHaveLength(1);
      expect(result.normalizations[0].canonical).toBe('Test Component');
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(401, 'Unauthorized'));

      const service = new OpenAIService({ apiKey: 'sk-test-key' });

      await expect(service.normalizeComponents(['test'])).rejects.toThrow(
        'OpenAI API error: 401'
      );
    });

    it('should throw error when response has no content', async () => {
      const emptyResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '' } }],
        }),
      } as Response;
      mockFetch.mockResolvedValue(emptyResponse);

      const service = new OpenAIService({ apiKey: 'sk-test-key' });

      await expect(service.normalizeComponents(['test'])).rejects.toThrow(
        'No response content from AI'
      );
    });

    it('should throw error when JSON parsing fails', async () => {
      const mockResponse = createMockResponse('This is not valid JSON');
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({ apiKey: 'sk-test-key' });

      await expect(service.normalizeComponents(['test'])).rejects.toThrow(
        'Could not parse JSON from AI response'
      );
    });

    it('should handle multiple components in a single request', async () => {
      const mockResponse = createMockResponse(JSON.stringify({
        normalizations: [
          { canonical: 'Door Frame', variants: ['door jamb'], confidence: 0.95 },
          { canonical: 'Window Sill', variants: ['WINDOW SILL'], confidence: 0.98 },
          { canonical: 'Baseboard', variants: ['basebrd'], confidence: 0.85 },
        ],
      }));
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({ apiKey: 'sk-test-key' });
      const result = await service.normalizeComponents([
        'door jamb',
        'WINDOW SILL',
        'basebrd',
      ]);

      expect(result.normalizations).toHaveLength(3);
      
      // Verify the prompt includes all components
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[1].content).toContain('door jamb');
      expect(body.messages[1].content).toContain('WINDOW SILL');
      expect(body.messages[1].content).toContain('basebrd');
    });
  });

  describe('Request Building', () => {
    it('should use custom OpenAI base URL when provided', async () => {
      const mockResponse = createMockResponse(JSON.stringify({ normalizations: [] }));
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({
        provider: 'openai',
        apiKey: 'sk-test-key',
        openaiBaseUrl: 'https://custom-openai.example.com/v1',
      });

      await service.normalizeComponents(['test']);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://custom-openai.example.com/v1/chat/completions');
    });

    it('should strip trailing slash from Azure endpoint', async () => {
      const mockResponse = createMockResponse(JSON.stringify({ normalizations: [] }));
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({
        provider: 'azure',
        apiKey: 'azure-key',
        azureEndpoint: 'https://myresource.openai.azure.com/', // With trailing slash
        model: 'deployment',
      });

      await service.normalizeComponents(['test']);

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('//openai'); // No double slash
    });

    it('should include temperature and maxTokens in request', async () => {
      const mockResponse = createMockResponse(JSON.stringify({ normalizations: [] }));
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({
        apiKey: 'sk-test-key',
        temperature: 0.3,
        maxTokens: 2000,
      });

      await service.normalizeComponents(['test']);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(2000);
    });
  });

  describe('JSON Extraction', () => {
    // Test the extractJson method indirectly through normalizeComponents
    it('should extract JSON from plain response', async () => {
      const mockResponse = createMockResponse('{"normalizations": []}');
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({ apiKey: 'sk-test-key' });
      const result = await service.normalizeComponents(['test']);

      expect(result.normalizations).toEqual([]);
    });

    it('should extract JSON from response with surrounding text', async () => {
      const mockResponse = createMockResponse('Here is the result: {"normalizations": [{"canonical": "Test Component", "variants": ["test"], "confidence": 0.9}]} Hope this helps!');
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({ apiKey: 'sk-test-key' });
      const result = await service.normalizeComponents(['test']);

      expect(result.normalizations).toHaveLength(1);
    });

    it('should extract JSON from markdown code block without language tag', async () => {
      const mockResponse = createMockResponse('```\n{"normalizations": []}\n```');
      mockFetch.mockResolvedValue(mockResponse);

      const service = new OpenAIService({ apiKey: 'sk-test-key' });
      const result = await service.normalizeComponents(['test']);

      expect(result.normalizations).toEqual([]);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getOpenAIService', () => {
      const instance1 = getOpenAIService();
      const instance2 = getOpenAIService();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance with initializeOpenAIService', () => {
      // Get initial instance (we don't need to use it, just ensure singleton exists)
      getOpenAIService();
      
      const initialized = initializeOpenAIService({ apiKey: 'sk-new-key' });
      const retrieved = getOpenAIService();

      expect(initialized).toBe(retrieved);
      expect(initialized.getConfig().apiKey).toBe('sk-new-key');
    });
  });
});
