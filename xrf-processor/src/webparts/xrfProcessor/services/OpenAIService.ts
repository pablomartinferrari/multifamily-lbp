import {
  IOpenAIConfig,
  DEFAULT_OPENAI_CONFIG,
  NORMALIZATION_SYSTEM_PROMPT,
  AIProvider,
} from "../config/OpenAIConfig";
import { INormalizationResult } from "../models/INormalization";

/**
 * OpenAI/Azure OpenAI API response structure (same for both)
 */
interface IOpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Service for calling OpenAI or Azure OpenAI API
 * Supports switching between providers via configuration
 */
export class OpenAIService {
  private config: IOpenAIConfig;

  constructor(config: Partial<IOpenAIConfig> = {}) {
    this.config = { ...DEFAULT_OPENAI_CONFIG, ...config };
  }

  /**
   * Update configuration (e.g., set API key or switch provider)
   */
  setConfig(config: Partial<IOpenAIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): IOpenAIConfig {
    return { ...this.config };
  }

  /**
   * Get current provider
   */
  getProvider(): AIProvider {
    return this.config.provider;
  }

  /**
   * Check if the service is configured with valid credentials
   */
  isConfigured(): boolean {
    if (!this.config.apiKey) return false;

    if (this.config.provider === "openai") {
      return this.config.apiKey.startsWith("sk-");
    } else {
      // Azure OpenAI - need endpoint and deployment
      return !!(this.config.azureEndpoint && this.config.model);
    }
  }

  /**
   * Normalize component names using AI
   * @param componentNames - Array of unique component names to normalize
   */
  async normalizeComponents(componentNames: string[]): Promise<INormalizationResult> {
    if (componentNames.length === 0) {
      return { normalizations: [] };
    }

    if (!this.isConfigured()) {
      throw new Error(
        this.config.provider === "openai"
          ? "OpenAI API key not configured"
          : "Azure OpenAI not configured (need endpoint, key, and deployment)"
      );
    }

    const userPrompt = `Normalize these component names from an XRF lead paint inspection:

${componentNames.join("\n")}

Return ONLY the JSON object, no other text.`;

    const response = await this.callChatCompletion(
      NORMALIZATION_SYSTEM_PROMPT,
      userPrompt
    );

    // Parse JSON from response
    const jsonResult = this.extractJson(response);
    if (!jsonResult) {
      console.error("Failed to parse AI response:", response);
      throw new Error("Could not parse JSON from AI response");
    }

    return jsonResult as INormalizationResult;
  }

  /**
   * Call Chat Completions API (works with both OpenAI and Azure)
   */
  private async callChatCompletion(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const { url, headers, body } = this.buildRequest(systemPrompt, userPrompt);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${this.config.provider} API error:`, response.status, errorText);
      throw new Error(
        `${this.config.provider === "openai" ? "OpenAI" : "Azure OpenAI"} API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as IOpenAIResponse;
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from AI");
    }

    return content;
  }

  /**
   * Build request URL, headers, and body based on provider
   */
  private buildRequest(
    systemPrompt: string,
    userPrompt: string
  ): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    if (this.config.provider === "azure") {
      // Azure OpenAI format
      const endpoint = this.config.azureEndpoint?.replace(/\/$/, "");
      const apiVersion = this.config.azureApiVersion || "2024-02-15-preview";
      const url = `${endpoint}/openai/deployments/${this.config.model}/chat/completions?api-version=${apiVersion}`;

      return {
        url,
        headers: {
          "Content-Type": "application/json",
          "api-key": this.config.apiKey,
        },
        body: {
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        },
      };
    } else {
      // Standard OpenAI format
      const baseUrl = this.config.openaiBaseUrl || "https://api.openai.com/v1";
      const url = `${baseUrl}/chat/completions`;

      return {
        url,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: {
          model: this.config.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        },
      };
    }
  }

  /**
   * Extract JSON object from AI response (handles markdown code blocks)
   */
  private extractJson(content: string): INormalizationResult | undefined {
    // Try to find JSON in markdown code block first
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // Continue to try other methods
      }
    }

    // Try to find raw JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Continue to try other methods
      }
    }

    // Try parsing the whole content
    try {
      return JSON.parse(content.trim());
    } catch {
      return undefined;
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let openAIServiceInstance: OpenAIService | undefined;

export function getOpenAIService(): OpenAIService {
  if (!openAIServiceInstance) {
    openAIServiceInstance = new OpenAIService();
  }
  return openAIServiceInstance;
}

export function initializeOpenAIService(config: Partial<IOpenAIConfig>): OpenAIService {
  openAIServiceInstance = new OpenAIService(config);
  return openAIServiceInstance;
}
