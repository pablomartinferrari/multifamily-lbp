# BB-06: Azure OpenAI Integration

> **Priority**: 🟡 High  
> **Estimated Effort**: 4-6 hours  
> **Dependencies**: BB-01, BB-03  
> **Status**: ✅ Complete

---

## Objective

Integrate Azure OpenAI to semantically normalize component names, grouping similar terms like "door jamb", "door-jamb", and "doorjamb" into a canonical form.

---

## Prerequisites

- BB-01 completed (SPFx project)
- BB-03 completed (SharePoint service for caching)
- Azure OpenAI resource provisioned
- Azure OpenAI API access approved

---

## Tasks

### 1. Create Configuration Types

Create `src/config/AzureOpenAIConfig.ts`:

```typescript
export interface IAzureOpenAIConfig {
  endpoint: string;        // https://[resource].openai.azure.com/
  apiKey: string;          // API key (store securely!)
  deploymentName: string;  // e.g., "gpt-35-turbo" or "gpt-4"
  apiVersion: string;      // e.g., "2024-02-15-preview"
}

// Default config - override with actual values
export const DEFAULT_OPENAI_CONFIG: IAzureOpenAIConfig = {
  endpoint: "",
  apiKey: "",
  deploymentName: "gpt-35-turbo",
  apiVersion: "2024-02-15-preview",
};
```

### 2. Create Normalization Models

Create `src/models/INormalization.ts`:

```typescript
export interface INormalizationGroup {
  canonical: string;        // The normalized/canonical name
  variants: string[];       // Original names that map to this
  confidence: number;       // AI confidence (0-1)
}

export interface INormalizationResult {
  normalizations: INormalizationGroup[];
}

export interface IComponentNormalization {
  originalName: string;
  normalizedName: string;
  confidence: number;
  source: "AI" | "CACHE" | "MANUAL";
}
```

### 3. Create Azure OpenAI Service

Create `src/services/AzureOpenAIService.ts`:

```typescript
import { IAzureOpenAIConfig } from "../config/AzureOpenAIConfig";
import { INormalizationResult } from "../models/INormalization";

export class AzureOpenAIService {
  private config: IAzureOpenAIConfig;

  constructor(config: IAzureOpenAIConfig) {
    this.config = config;
  }

  async normalizeComponents(componentNames: string[]): Promise<INormalizationResult> {
    if (componentNames.length === 0) {
      return { normalizations: [] };
    }

    const systemPrompt = `You are an expert in building components and lead paint inspection terminology.
Your task is to normalize component names from XRF inspection data.

Given a list of component names, group semantically similar names and return a canonical name for each group.

Consider:
- Spelling variations (wainscoting vs wainscot)
- Punctuation differences (door-jamb vs door jamb)
- Abbreviations (W/S = Window Sill)
- Synonyms in construction (baseboard = base molding)
- Case differences

Return ONLY valid JSON in this exact format:
{
  "normalizations": [
    {
      "canonical": "Door Jamb",
      "variants": ["door jamb", "door-jamb", "doorjamb"],
      "confidence": 0.95
    }
  ]
}`;

    const userPrompt = `Normalize these component names from an XRF lead paint inspection:
${componentNames.join("\n")}`;

    const url = `${this.config.endpoint}openai/deployments/${this.config.deploymentName}/chat/completions?api-version=${this.config.apiVersion}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.config.apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response content from Azure OpenAI");
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from AI response");
    }

    return JSON.parse(jsonMatch[0]) as INormalizationResult;
  }
}
```

### 4. Create Component Normalizer Service

Create `src/services/ComponentNormalizerService.ts`:

```typescript
import { AzureOpenAIService } from "./AzureOpenAIService";
import { SharePointService } from "./SharePointService";
import { IComponentNormalization, INormalizationGroup } from "../models/INormalization";

export class ComponentNormalizerService {
  private openAIService: AzureOpenAIService;
  private sharePointService: SharePointService;

  constructor(openAIService: AzureOpenAIService, sharePointService: SharePointService) {
    this.openAIService = openAIService;
    this.sharePointService = sharePointService;
  }

  async normalizeComponents(componentNames: string[]): Promise<IComponentNormalization[]> {
    const uniqueNames = [...new Set(componentNames.map(n => n.toLowerCase().trim()))];
    const results: IComponentNormalization[] = [];

    // Step 1: Check cache for existing mappings
    const cachedMappings = await this.sharePointService.getCachedMappings(uniqueNames);
    const uncachedNames: string[] = [];

    for (const name of uniqueNames) {
      const cached = cachedMappings.get(name);
      if (cached) {
        results.push({
          originalName: name,
          normalizedName: cached.NormalizedName,
          confidence: cached.Confidence,
          source: "CACHE",
        });
      } else {
        uncachedNames.push(name);
      }
    }

    // Step 2: Call AI for uncached names
    if (uncachedNames.length > 0) {
      const aiResult = await this.openAIService.normalizeComponents(uncachedNames);

      for (const group of aiResult.normalizations) {
        for (const variant of group.variants) {
          const normalizedVariant = variant.toLowerCase().trim();
          if (uncachedNames.includes(normalizedVariant)) {
            results.push({
              originalName: normalizedVariant,
              normalizedName: group.canonical,
              confidence: group.confidence,
              source: "AI",
            });
          }
        }
      }

      // Handle any names AI didn't group (use as-is with title case)
      for (const name of uncachedNames) {
        if (!results.find(r => r.originalName === name)) {
          results.push({
            originalName: name,
            normalizedName: this.toTitleCase(name),
            confidence: 1.0,
            source: "AI",
          });
        }
      }
    }

    return results;
  }

  async saveNormalizationsToCache(normalizations: IComponentNormalization[]): Promise<void> {
    const mappings = normalizations
      .filter(n => n.source === "AI")
      .map(n => ({
        originalName: n.originalName,
        normalizedName: n.normalizedName,
        confidence: n.confidence,
        source: "AI" as const,
      }));

    if (mappings.length > 0) {
      await this.sharePointService.updateComponentCache(mappings);
    }
  }

  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }
}
```

---

## Acceptance Criteria

- [ ] Can call Azure OpenAI API successfully
- [ ] Returns normalized component names with confidence scores
- [ ] Checks SharePoint cache before calling AI
- [ ] Caches new normalizations in SharePoint
- [ ] Handles API errors gracefully

---

## Output Artifacts

```
src/
├── config/
│   └── AzureOpenAIConfig.ts
├── models/
│   └── INormalization.ts
├── services/
│   ├── AzureOpenAIService.ts
│   └── ComponentNormalizerService.ts
```

---

## Security Notes

- Store API key in Azure Key Vault or SPFx property bag
- Never commit API keys to source control
- Use managed identity when possible

---

## Next Steps

➡️ Proceed to **BB-07: File Upload Component**



