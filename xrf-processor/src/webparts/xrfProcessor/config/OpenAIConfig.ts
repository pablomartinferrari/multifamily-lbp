/**
 * Supported AI providers
 */
export type AIProvider = "openai" | "azure";

/**
 * OpenAI/Azure OpenAI Configuration
 * Supports both standard OpenAI API and Azure OpenAI Service
 */
export interface IOpenAIConfig {
  /** Which provider to use */
  provider: AIProvider;
  /** API key */
  apiKey: string;
  /** Model to use (OpenAI) or deployment name (Azure) */
  model: string;
  /** Temperature for response randomness (0-1, lower = more deterministic) */
  temperature: number;
  /** Maximum tokens in response */
  maxTokens: number;

  // OpenAI-specific
  /** OpenAI API base URL (default: https://api.openai.com/v1) */
  openaiBaseUrl?: string;

  // Azure-specific
  /** Azure OpenAI resource endpoint (e.g., https://myresource.openai.azure.com) */
  azureEndpoint?: string;
  /** Azure OpenAI API version */
  azureApiVersion?: string;
}

/**
 * Default configuration for standard OpenAI
 */
export const DEFAULT_OPENAI_CONFIG: IOpenAIConfig = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 2000,
  openaiBaseUrl: "https://api.openai.com/v1",
};

/**
 * Default configuration for Azure OpenAI
 */
export const DEFAULT_AZURE_OPENAI_CONFIG: IOpenAIConfig = {
  provider: "azure",
  apiKey: "",
  model: "", // This is the deployment name in Azure
  temperature: 0.3,
  maxTokens: 2000,
  azureEndpoint: "", // e.g., https://myresource.openai.azure.com
  azureApiVersion: "2024-02-15-preview",
};

/**
 * System prompt for component normalization
 */
export const NORMALIZATION_SYSTEM_PROMPT = `You are an expert in building components and lead paint inspection terminology.
Your task is to normalize component names from XRF inspection data.

Given a list of component names, group semantically similar names and return a canonical name for each group.

Consider:
- Spelling variations (wainscoting vs wainscot)
- Punctuation differences (door-jamb vs door jamb vs doorjamb)
- Abbreviations (W/S = Window Sill, D/J = Door Jamb)
- Synonyms in construction (baseboard = base molding = base board)
- Case differences (DOOR JAMB = door jamb)
- Common typos

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "normalizations": [
    {
      "canonical": "Door Jamb",
      "variants": ["door jamb", "door-jamb", "doorjamb", "D/J"],
      "confidence": 0.95
    }
  ]
}

Important:
- Use Title Case for canonical names
- Include the original name in variants
- Confidence should be 0.8-1.0 based on how certain the grouping is
- Each input name should appear in exactly one group`;
