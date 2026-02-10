/**
 * Lead Inspector AI Service
 * Acts as a HUD/EPA lead paint inspector to generate hazard descriptions
 * and remediation options for each positive component
 */

import { getOpenAIService } from "./OpenAIService";
import {
  getAbatementText,
  getInterimControlText,
  getAbatementCodes,
  getInterimControlCodes,
} from "./HazReference";
import type { ILeadPaintHazard } from "../models/ISummary";
import type {
  IAverageComponentSummary,
  IUniformComponentSummary,
  INonUniformComponentSummary,
} from "../models/ISummary";

/** Input for AI - one positive component to assess */
export interface IPositiveComponentInput {
  component: string;
  substrate?: string;
  areaType: "COMMON_AREA" | "UNITS";
  totalReadings: number;
  positiveCount: number;
  classificationType: "AVERAGE" | "UNIFORM" | "NON_UNIFORM";
}

/** Raw AI response per hazard */
interface IAIHazardResponse {
  hazardDescription: string;
  severity: "Critical" | "High" | "Moderate";
  priority: "Restrict Access" | "ASAP" | "Schedule";
  abateCode: string;
  icCode: string;
}

const LEAD_INSPECTOR_SYSTEM_PROMPT = `You are a HUD/EPA certified lead paint inspector and risk assessor.
Your task is to assess each identified positive lead-based paint component and produce:
1. A concise hazard description (1-2 sentences) suitable for a lead inspection report
2. Severity: Critical, High, or Moderate
3. Priority: Restrict Access, ASAP, or Schedule
4. An abatement code and interim control code from the reference tables below

Write hazard descriptions in the style of a professional lead inspector. Example:
"The [component] within [common areas/units] represent lead-based paint hazards and must be repaired or repainted."
Or for location-specific: "The [specific component] in [location] is a lead hazard and requires remediation."

ABATEMENT CODES (use the code letter, e.g. "d", "h"):
${getAbatementCodes().map((c) => `- ${c}`).join("\n")}

INTERIM CONTROL CODES (use the number, e.g. "5", "4"):
${getInterimControlCodes().map((c) => `- ${c}`).join("\n")}

Guidelines:
- Windows/window components: typically e, f, or g for abatement; 5, 6, or 7 for IC
- Doors/door components: typically h or i for abatement; 4 or 5 for IC
- Walls, trim, baseboards: typically d, j, or l for abatement; 5 or 6 for IC
- Dust hazards: typically a or b for abatement; 1 or 2 for IC
- High severity + ASAP for deteriorating or high-exposure items
- Moderate + Schedule for intact, low-exposure items

Return ONLY valid JSON array, no other text:
[
  {
    "hazardDescription": "The orange metal elevator door casings on the first floor are lead hazards and must be repaired/repainted.",
    "severity": "Moderate",
    "priority": "Schedule",
    "abateCode": "d",
    "icCode": "5"
  }
]`;

/**
 * Collect positive components from dataset summaries for Lead Inspector AI
 */
export function collectPositiveComponents(
  commonAreaSummary: { averageComponents: IAverageComponentSummary[]; uniformComponents: IUniformComponentSummary[]; nonUniformComponents: INonUniformComponentSummary[] } | undefined,
  unitsSummary: { averageComponents: IAverageComponentSummary[]; uniformComponents: IUniformComponentSummary[]; nonUniformComponents: INonUniformComponentSummary[] } | undefined
): IPositiveComponentInput[] {
  const items: IPositiveComponentInput[] = [];

  const processDataset = (
    summary: { averageComponents: IAverageComponentSummary[]; uniformComponents: IUniformComponentSummary[]; nonUniformComponents: INonUniformComponentSummary[] },
    areaType: "COMMON_AREA" | "UNITS"
  ): void => {
    for (const c of summary.averageComponents) {
      if (c.result === "POSITIVE") {
        items.push({
          component: c.component,
          substrate: c.substrate,
          areaType,
          totalReadings: c.totalReadings,
          positiveCount: c.positiveCount,
          classificationType: "AVERAGE",
        });
      }
    }
    for (const c of summary.uniformComponents) {
      if (c.result === "POSITIVE") {
        items.push({
          component: c.component,
          substrate: c.substrate,
          areaType,
          totalReadings: c.totalReadings,
          positiveCount: c.totalReadings,
          classificationType: "UNIFORM",
        });
      }
    }
    for (const c of summary.nonUniformComponents) {
      items.push({
        component: c.component,
        substrate: c.substrate,
        areaType,
        totalReadings: c.totalReadings,
        positiveCount: c.positiveCount,
        classificationType: "NON_UNIFORM",
      });
    }
  };

  if (commonAreaSummary) processDataset(commonAreaSummary, "COMMON_AREA");
  if (unitsSummary) processDataset(unitsSummary, "UNITS");

  return items;
}

/**
 * Generate hazards for positive components using Lead Inspector AI
 */
export async function generateHazards(
  positiveComponents: IPositiveComponentInput[]
): Promise<ILeadPaintHazard[]> {
  if (positiveComponents.length === 0) return [];

  const openAI = getOpenAIService();
  if (!openAI.isConfigured()) {
    console.warn("OpenAI not configured - skipping hazards generation");
    return [];
  }

  const userPrompt = `Assess these positive lead-based paint components and return one hazard entry per component.

Components (JSON):
${JSON.stringify(positiveComponents, null, 2)}

Return a JSON array with one object per component. Each object must have: hazardDescription, severity, priority, abateCode, icCode.`;

  try {
    const response = await openAI.chat(LEAD_INSPECTOR_SYSTEM_PROMPT, userPrompt);
    const json = extractJson(response);
    if (!json || !Array.isArray(json)) {
      console.warn("Lead Inspector AI did not return valid array:", response?.substring(0, 200));
      return [];
    }

    const hazards: ILeadPaintHazard[] = [];
    for (let i = 0; i < json.length; i++) {
      const raw = json[i] as IAIHazardResponse;
      const input = positiveComponents[i];
      if (!input || !raw?.hazardDescription) continue;

      const abateCode = String(raw.abateCode || "d").trim().toLowerCase();
      const icCode = String(raw.icCode || "5").trim();

      hazards.push({
        hazardDescription: raw.hazardDescription,
        severity: raw.severity || "Moderate",
        priority: raw.priority || "Schedule",
        abateCode,
        icCode,
        abatementOptions: getAbatementText(abateCode),
        interimControlOptions: getInterimControlText(icCode),
        component: input.component,
        substrate: input.substrate,
        areaType: input.areaType,
      });
    }
    return hazards;
  } catch (error) {
    console.error("Lead Inspector AI failed:", error);
    return [];
  }
}

function extractJson(text: string): unknown {
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      return JSON.parse(match[0]) as unknown;
    } catch {
      // fallthrough
    }
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
