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
Your task is to normalize component names from XRF inspection data into CONSISTENT canonical forms.

Given a list of component names, group ALL semantically equivalent names and return ONE canonical name for each group.

CRITICAL: Abbreviations and their full forms MUST be grouped together with the FULL WORD as canonical:
- "clos." / "clos" = "closet" → canonical: "Closet ___"
- "wd" / "wd." = "wood" → canonical: "___ Wood" or "Wood ___"
- "dr" / "dr." = "door" → canonical: "Door ___"
- "win" / "wndw" / "wdw" = "window" → canonical: "Window ___"
- "kit" / "kitch" = "kitchen" → canonical: "Kitchen ___"
- "brm" / "bdrm" / "bedrm" = "bedroom" → canonical: "Bedroom ___"
- "bthrm" / "bath" / "ba" = "bathroom" → canonical: "Bathroom ___"
- "cab" / "cab." = "cabinet" → canonical: "Cabinet ___"
- "ceil" = "ceiling" → canonical: "Ceiling ___"
- "bsmt" / "basmt" = "basement" → canonical: "Basement ___"
- "ext" = "exterior" → canonical: "Exterior ___"
- "int" = "interior" → canonical: "Interior ___"
- "rm" = "room" → canonical: "___ Room"
- "flr" = "floor" → canonical: "Floor ___"
- "trim" / "trm" = "trim" → canonical: "___ Trim"

Common abbreviations with punctuation (treat identically):
- "clos. wall" = "closet wall" = "clos wall" → "Closet Wall"
- "kit. cab" = "kitchen cabinet" = "kitch cab" → "Kitchen Cabinet"
- "dr. jamb" = "door jamb" = "dr jamb" → "Door Jamb"

Also consider:
- Spelling variations (wainscoting vs wainscot)
- Punctuation differences (door-jamb vs door jamb vs doorjamb)
- Synonyms in construction (baseboard = base molding = base board)
- Case differences (DOOR JAMB = door jamb)
- Common typos
- Partial matches ("closet" in "closet wall" matches "clos." in "clos. wall")

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "normalizations": [
    {
      "canonical": "Door Jamb",
      "variants": ["door jamb", "door-jamb", "doorjamb", "D/J", "dr jamb", "dr. jamb"],
      "confidence": 0.95
    },
    {
      "canonical": "Closet Wall",
      "variants": ["closet wall", "clos. wall", "clos wall", "Closet wall"],
      "confidence": 0.95
    }
  ]
}

Important:
- ALWAYS use the FULL, EXPANDED word in canonical names (never abbreviations)
- Use Title Case for canonical names
- Include the original name in variants
- Group ALL forms of the same component (abbreviated + full + mixed case) together
- Confidence should be 0.8-1.0 based on how certain the grouping is
- Each input name should appear in exactly one group`;

/**
 * System prompt for substrate normalization
 */
export const SUBSTRATE_NORMALIZATION_SYSTEM_PROMPT = `You are an expert in building materials and lead paint inspection terminology.
Your task is to normalize substrate (surface material) names from XRF inspection data into CONSISTENT canonical forms.

Given a list of substrate names, group ALL semantically equivalent names and return ONE canonical name for each group.

CRITICAL: Abbreviations and their full forms MUST be grouped together with the FULL WORD as canonical:
- "wd" / "wd." = "wood" → canonical: "Wood"
- "mtl" / "met" = "metal" → canonical: "Metal"
- "pls" / "plst" = "plaster" → canonical: "Plaster"
- "dw" / "drywl" = "drywall" → canonical: "Drywall"
- "conc" / "cncrt" = "concrete" → canonical: "Concrete"
- "brk" = "brick" → canonical: "Brick"
- "ply" / "plwd" = "plywood" → canonical: "Plywood" (or group with Wood)

Synonyms that MUST be grouped:
- "drywall" = "dry wall" = "sheetrock" = "gypsum" = "gypsum board" = "wallboard" → "Drywall"
- "wood" = "wd" = "lumber" = "timber" → "Wood"
- "metal" = "mtl" = "steel" = "iron" = "aluminum" → "Metal"
- "hardwood" = "hard wood" = "hwd" → "Hardwood" (or group with Wood)
- "softwood" = "soft wood" = "swd" → "Softwood" (or group with Wood)

Common substrate categories for lead paint inspection:
- Wood (includes hardwood, softwood, plywood, lumber, wd)
- Metal (includes steel, iron, aluminum, brass, mtl)
- Drywall (includes gypsum, sheetrock, wallboard, dw)
- Plaster (includes pls, plst)
- Concrete (includes cement, masonry, conc)
- Brick (includes brk, masonry)
- Glass
- Plastic (includes vinyl, PVC)

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "normalizations": [
    {
      "canonical": "Wood",
      "variants": ["wood", "wd", "wd.", "hardwood", "hard wood", "softwood", "lumber"],
      "confidence": 0.95
    }
  ]
}

Important:
- ALWAYS use the FULL, EXPANDED word in canonical names (never abbreviations)
- Use Title Case for canonical names
- Include the original name in variants
- Group ALL forms of the same material (abbreviated + full + mixed case) together
- Confidence should be 0.8-1.0 based on how certain the grouping is
- Each input name should appear in exactly one group
- Prefer broader material categories (Wood, Metal) over specific types when grouping`;