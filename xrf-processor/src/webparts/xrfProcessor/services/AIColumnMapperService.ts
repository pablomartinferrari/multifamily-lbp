import { IOpenAIConfig } from "../config/OpenAIConfig";

/**
 * Result of AI column mapping
 */
export interface IAIColumnMapping {
  /** Mapped column for reading ID */
  readingId?: string;
  /** Mapped column for component name */
  component?: string;
  /** Mapped column for color */
  color?: string;
  /** Mapped column for lead content (mg/cm²) */
  leadContent?: string;
  /** Mapped column for location/room */
  location?: string;
  /** Mapped column for substrate material */
  substrate?: string;
  /** Mapped column for side (A/B) */
  side?: string;
  /** Mapped column for condition */
  condition?: string;
  /** Mapped column for timestamp */
  timestamp?: string;
  /** Mapped column for positive/negative result */
  result?: string;
  /** Columns that couldn't be mapped */
  unmapped: string[];
  /** Confidence in the overall mapping (0-1) */
  confidence: number;
}

/**
 * AI response format for column mapping
 */
interface IAIColumnMappingResponse {
  mappings: {
    field: string;
    column: string;
    confidence: number;
    reasoning?: string;
  }[];
  unmapped: string[];
  overallConfidence: number;
}

/**
 * System prompt for AI column mapping
 */
const COLUMN_MAPPING_SYSTEM_PROMPT = `You are an expert in XRF (X-ray Fluorescence) lead paint inspection data.
Your task is to map Excel column headers from various XRF device exports to standardized field names.

Given a list of column headers, identify which column corresponds to each of these standard fields:

REQUIRED FIELDS:
- readingId: Unique identifier for each reading (e.g., "Reading #", "Test ID", "Rdg", "Sample", "Measurement ID")
- component: Building component being tested (e.g., "Component", "Element", "Substrate Component", "Test Location", "Item")
- leadContent: Lead concentration in mg/cm² (e.g., "Pb", "Lead", "Result", "XRF Result", "Conc", "Reading", "PbC", "Lead Content")

IMPORTANT FOR COLOR (Required field):
- color: Paint/coating color (e.g., "Color", "Colour", "Paint Color", "Coating")

OPTIONAL FIELDS:
- location: Room or unit being tested (e.g., "Room", "Location", "Unit", "Area", "Space", "Apt")
- substrate: Base material under paint (e.g., "Substrate", "Surface", "Material", "Base")
- side: Which side of component (e.g., "Side", "Face", "A/B", "Surface")
- condition: Paint condition (e.g., "Condition", "Status", "Intact/Deficient")
- timestamp: Date/time of reading (e.g., "Date", "Time", "DateTime", "Timestamp")
- result: Positive/Negative classification (e.g., "Result", "Pos/Neg", "Classification", "Status", "+/-")

IMPORTANT NOTES:
- XRF machines from different manufacturers use different column names
- Some columns may have numeric suffixes or abbreviations
- "Result" could mean either lead content OR pos/neg - look at context
- If a column contains numeric values with "mg/cm" it's likely leadContent
- If a column contains "Pos"/"Neg" or "+"/"-" text it's likely result
- Room numbers like "101", "Unit 5" are location, not readingId

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "mappings": [
    {"field": "readingId", "column": "Reading #", "confidence": 0.95, "reasoning": "Standard reading ID header"},
    {"field": "leadContent", "column": "Pb (mg/cm²)", "confidence": 0.98, "reasoning": "Contains lead measurement unit"}
  ],
  "unmapped": ["Notes", "Operator"],
  "overallConfidence": 0.92
}`;

/**
 * Service for AI-powered Excel column mapping
 */
export class AIColumnMapperService {
  private config: IOpenAIConfig;

  constructor(config: IOpenAIConfig) {
    this.config = config;
  }

  /**
   * Check if the service is configured with an API key
   */
  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Map Excel column headers to standard XRF fields using AI
   * @param headers - Array of column headers from Excel file
   * @param sampleData - Optional sample data rows to help AI understand context
   * @returns Mapping of standard fields to Excel column names
   */
  async mapColumns(
    headers: string[],
    sampleData?: Record<string, unknown>[]
  ): Promise<IAIColumnMapping> {
    if (!this.isConfigured()) {
      throw new Error("AI Column Mapper is not configured. API key is missing.");
    }

    // Build the prompt with headers and optional sample data
    let userPrompt = `Map these Excel column headers to XRF data fields:\n\nHeaders: ${JSON.stringify(headers)}`;

    if (sampleData && sampleData.length > 0) {
      // Include first 3 rows as sample to help AI understand data types
      const samples = sampleData.slice(0, 3);
      userPrompt += `\n\nSample data (first ${samples.length} rows):\n${JSON.stringify(samples, null, 2)}`;
    }

    try {
      const response = await this.callOpenAI(userPrompt);
      return this.parseResponse(response, headers);
    } catch (error) {
      console.error("AI column mapping failed:", error);
      throw error;
    }
  }

  /**
   * Call OpenAI/Azure OpenAI API
   */
  private async callOpenAI(userPrompt: string): Promise<string> {
    const { provider, apiKey, model, azureEndpoint, azureApiVersion } = this.config;

    let endpoint: string;
    let headers: Record<string, string>;

    if (provider === "azure") {
      if (!azureEndpoint) {
        throw new Error("Azure endpoint is required for Azure OpenAI");
      }
      endpoint = `${azureEndpoint}/openai/deployments/${model}/chat/completions?api-version=${azureApiVersion || "2024-02-15-preview"}`;
      headers = {
        "Content-Type": "application/json",
        "api-key": apiKey,
      };
    } else {
      endpoint = `${this.config.openaiBaseUrl || "https://api.openai.com/v1"}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };
    }

    const body = {
      model: provider === "azure" ? undefined : model,
      messages: [
        { role: "system", content: COLUMN_MAPPING_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2, // Lower temperature for more consistent mapping
      max_tokens: 1500,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  }

  /**
   * Parse AI response into structured mapping
   */
  private parseResponse(responseText: string, originalHeaders: string[]): IAIColumnMapping {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let aiResponse: IAIColumnMappingResponse;
    try {
      aiResponse = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", responseText);
      throw new Error("Failed to parse AI column mapping response");
    }

    // Convert AI response to our mapping format
    const result: IAIColumnMapping = {
      unmapped: aiResponse.unmapped || [],
      confidence: aiResponse.overallConfidence || 0,
    };

    // Valid field names we can map
    const validFields = ["readingId", "component", "color", "leadContent", "location", "substrate", "side", "condition", "timestamp", "result"];

    // Map each field
    for (const mapping of aiResponse.mappings) {
      const field = mapping.field;
      
      // Validate that the column exists in original headers (case-insensitive)
      const matchedHeader = originalHeaders.find(
        h => h.toLowerCase().trim() === mapping.column.toLowerCase().trim()
      );

      if (validFields.includes(field)) {
        const columnValue = matchedHeader || mapping.column;
        switch (field) {
          case "readingId": result.readingId = columnValue; break;
          case "component": result.component = columnValue; break;
          case "color": result.color = columnValue; break;
          case "leadContent": result.leadContent = columnValue; break;
          case "location": result.location = columnValue; break;
          case "substrate": result.substrate = columnValue; break;
          case "side": result.side = columnValue; break;
          case "condition": result.condition = columnValue; break;
          case "timestamp": result.timestamp = columnValue; break;
          case "result": result.result = columnValue; break;
        }
      }
    }

    return result;
  }

  /**
   * Validate that required columns are mapped
   * @param mapping - The AI-generated column mapping
   * @returns Object with validation result and missing fields
   */
  validateMapping(mapping: IAIColumnMapping): {
    isValid: boolean;
    missingRequired: string[];
    warnings: string[];
  } {
    const missingRequired: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!mapping.readingId) missingRequired.push("readingId");
    if (!mapping.component) missingRequired.push("component");
    if (!mapping.leadContent) missingRequired.push("leadContent");

    // Warnings for recommended fields
    if (!mapping.color) warnings.push("color column not found - will default to 'Unknown'");
    if (!mapping.location) warnings.push("location column not found - unit/room info will be missing");

    // Confidence warning
    if (mapping.confidence < 0.7) {
      warnings.push(`Low confidence mapping (${(mapping.confidence * 100).toFixed(0)}%) - please verify`);
    }

    return {
      isValid: missingRequired.length === 0,
      missingRequired,
      warnings,
    };
  }
}

// ============================================
// Factory Function
// ============================================

let mapperInstance: AIColumnMapperService | undefined;

export function initializeAIColumnMapper(config: IOpenAIConfig): void {
  mapperInstance = new AIColumnMapperService(config);
}

export function getAIColumnMapperService(): AIColumnMapperService {
  if (!mapperInstance) {
    throw new Error("AIColumnMapperService not initialized. Call initializeAIColumnMapper first.");
  }
  return mapperInstance;
}
