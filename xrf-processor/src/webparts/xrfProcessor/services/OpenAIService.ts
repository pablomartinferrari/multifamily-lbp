import {
  IOpenAIConfig,
  DEFAULT_OPENAI_CONFIG,
  NORMALIZATION_SYSTEM_PROMPT,
  SUBSTRATE_NORMALIZATION_SYSTEM_PROMPT,
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
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 1000; // Minimum 1 second between requests

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
   * Normalize substrate (surface material) names using AI
   * @param substrateNames - Array of unique substrate names to normalize
   */
  async normalizeSubstrates(substrateNames: string[]): Promise<INormalizationResult> {
    if (substrateNames.length === 0) {
      return { normalizations: [] };
    }

    if (!this.isConfigured()) {
      throw new Error(
        this.config.provider === "openai"
          ? "OpenAI API key not configured"
          : "Azure OpenAI not configured (need endpoint, key, and deployment)"
      );
    }

    const userPrompt = `Normalize these substrate (surface material) names from an XRF lead paint inspection:

${substrateNames.join("\n")}

Return ONLY the JSON object, no other text.`;

    const response = await this.callChatCompletion(
      SUBSTRATE_NORMALIZATION_SYSTEM_PROMPT,
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
   * Generate a short conversational message for a given step in the upload flow.
   * Used to guide the user with friendly, contextual prompts (e.g. "Hey Sarah, what's the job number?").
   * Falls back to a template message if OpenAI is not configured or the request fails.
   */
  async generateConversationStepMessage(
    stepId: "welcome" | "job_number" | "job_result" | "area_type" | "file_upload" | "ready",
    context: {
      userName?: string;
      jobNumber?: string;
      jobFound?: boolean;
      hasExistingData?: boolean;
      hasUnits?: boolean;
      hasCommonAreas?: boolean;
      areaType?: "Units" | "Common Areas";
    }
  ): Promise<string> {
    const fallbacks: Record<typeof stepId, string> = {
      welcome:
        "Enter the job number below and we'll look it up in ETC Files. Or skip for a temporary test run.",
      job_number:
        "Enter the job number below and we'll look it up in ETC Files. Or skip for a temporary test run.",
      job_result: "What would you like to do next?",
      area_type: "Are you uploading Units or Common Areas?",
      file_upload:
        "Upload one or many files with the raw data. You can select multiple .xlsx or .csv files.",
      ready: "Ready to process? Click the button below to upload and save.",
    };

    if (!this.isConfigured()) {
      const name = context.userName ? `Hey ${context.userName}, ` : "";
      if (stepId === "welcome" || stepId === "job_number") {
        return `${name}${fallbacks.welcome}`;
      }
      return fallbacks[stepId];
    }

    const systemPrompt = `You are a friendly assistant for an XRF lead paint data upload app. Generate exactly one short message (1-2 sentences) to guide the user for the current step. Be warm and conversational. Use the user's name if provided. Do not use quotes around your response. Do not add greetings like "Here's your message:" or bullet points. Output only the message.`;

    const contextStr = JSON.stringify({
      step: stepId,
      userName: context.userName,
      jobNumber: context.jobNumber,
      jobFound: context.jobFound,
      hasExistingData: context.hasExistingData,
      hasUnits: context.hasUnits,
      hasCommonAreas: context.hasCommonAreas,
      areaType: context.areaType,
    });

    const userPrompt = `Step: ${stepId}. Context: ${contextStr}. Generate the single guiding message for the user.`;

    try {
      const message = await this.callChatCompletion(systemPrompt, userPrompt);
      const trimmed = (message || "").trim();
      if (trimmed.length > 0 && trimmed.length <= 300) return trimmed;
    } catch (err) {
      console.warn("generateConversationStepMessage failed, using fallback:", err);
    }

    const name = context.userName && (stepId === "welcome" || stepId === "job_number") ? `Hey ${context.userName}, ` : "";
    if (stepId === "job_result" && context.hasExistingData) {
      const parts: string[] = [];
      if (context.hasUnits) parts.push("Units");
      if (context.hasCommonAreas) parts.push("Common Areas");
      const existing = parts.length > 0 ? `This job already has ${parts.join(" and ")} data. ` : "";
      return `${existing}Generate a report from it or upload new data.`.trim();
    }
    if (stepId === "area_type" && context.hasExistingData) {
      const parts: string[] = [];
      if (context.hasUnits) parts.push("Units");
      if (context.hasCommonAreas) parts.push("Common Areas");
      const existing = parts.length > 0 ? ` You already have ${parts.join(" and ")} data for this job.` : "";
      return `${existing} Are you uploading Units or Common Areas?`.trim();
    }
    return name + fallbacks[stepId];
  }

  /**
   * General chat completion for Q&A (used by help assistant)
   * @param systemPrompt - System prompt with context
   * @param userMessage - User's question
   */
  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        this.config.provider === "openai"
          ? "OpenAI API key not configured"
          : "Azure OpenAI not configured (need endpoint, key, and deployment)"
      );
    }

    return this.callChatCompletion(systemPrompt, userMessage);
  }

  /**
   * Call Chat Completions API (works with both OpenAI and Azure)
   */
  private async callChatCompletion(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    // Rate limiting: ensure minimum interval between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();

    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { url, headers, body } = this.buildRequest(systemPrompt, userPrompt);

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`${this.config.provider} API error:`, response.status, errorText);

          // Handle rate limiting (429) with retry
          if (response.status === 429 && attempt < maxRetries) {
            const retryDelay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
            console.warn(`Rate limited. Retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }

          // Handle other errors or final retry attempt
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
      } catch (error) {
        lastError = error as Error;

        // Don't retry on non-rate-limit errors or if this is the last attempt
        if (!(error as Error).message.includes("429") || attempt === maxRetries) {
          throw error;
        }
      }
    }

    // This should never be reached, but just in case
    throw new Error(`OpenAI API request failed after ${maxRetries + 1} attempts: ${lastError!.message}`);
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
