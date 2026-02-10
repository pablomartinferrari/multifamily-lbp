/**
 * Haz reference lookup - Abatement and Interim Control options
 * Extracted from standard HUD/EPA lead inspection report template
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const haz = require("../config/HazReference.json") as {
  abatement: Record<string, string>;
  interim: Record<string, string>;
};

/**
 * Get full abatement option text by code (e.g., "d", "h")
 */
export function getAbatementText(code: string): string {
  const normalized = String(code || "").trim().toLowerCase();
  return haz.abatement[normalized] || `[Abatement option ${code || "?"} not found]`;
}

/**
 * Get full interim control option text by code (e.g., "5", "4")
 */
export function getInterimControlText(code: string): string {
  const normalized = String(code || "").trim();
  return haz.interim[normalized] || `[Interim control option ${code || "?"} not found]`;
}

/**
 * Get all valid abatement codes (for AI prompt context)
 */
export function getAbatementCodes(): string[] {
  return Object.keys(haz.abatement);
}

/**
 * Get all valid interim control codes (for AI prompt context)
 */
export function getInterimControlCodes(): string[] {
  return Object.keys(haz.interim);
}
