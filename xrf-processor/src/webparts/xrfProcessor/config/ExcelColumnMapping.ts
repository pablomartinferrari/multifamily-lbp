/**
 * Maps Excel column headers to IXrfReading properties
 * Update these mappings based on actual XRF device export format
 */
export interface IColumnMapping {
  // Required columns
  readingId: string[];
  component: string[];
  color: string[];
  leadContent: string[];

  // Optional columns - Location hierarchy
  location: string[];      // Full location string (optional combined field)
  unitNumber: string[];    // Unit/Apartment number (e.g., "101")
  roomType: string[];      // Room type (e.g., "Bedroom")
  roomNumber: string[];    // Room number within unit (e.g., "1" for Bedroom 1)

  // Optional columns - Other
  substrate: string[];
  side: string[];          // Side A/B/C/D
  condition: string[];
  timestamp: string[];
}

/**
 * Default column mappings
 * Supports variations from different XRF device exports
 */
export const DEFAULT_COLUMN_MAPPING: IColumnMapping = {
  // Reading ID variations
  readingId: [
    "Reading ID",
    "ReadingID",
    "Reading #",
    "Reading Number",
    "ID",
    "Rdg",
    "Reading",
    "Test ID",
    "Test #",
    "Sample ID",
  ],

  // Component variations (include truncated and all-caps Excel headers)
  component: [
    "Component",
    "COMPONENT",
    "Components",
    "COMPONE",
    "COMPON",
    "Building Component",
    "Comp",
    "Component Type",
    "Testing Component",
    "Substrate Component",
    "Test Component",
    "Element",
  ],

  // Color variations (include truncated headers e.g. COLOR)
  color: [
    "Color",
    "COLOR",
    "Paint Color",
    "Colour",
    "Surface Color",
    "Coating Color",
  ],

  // Lead content variations (mg/cm²); include truncated e.g. Concentra, Result
  leadContent: [
    "PbC",
    "PbC (mg/cm²)",
    "PbC (mg/cm2)",
    "Lead Content",
    "Lead (mg/cm²)",
    "Lead (mg/cm2)",
    "Lead",
    "Pb",
    "Pb Content",
    "Lead Concentration",
    "Concentration", // Pb200i / Viken devices
    "Concentra",     // Truncated
    "mg/cm²",
    "mg/cm2",
    "Result",
    "RESULT",
    "XRF Result",
    "Lead Result",
    "Pb (mg/cm²)",
  ],

  // Location variations (full location string - optional combined field)
  location: [
    "Location",
    "Full Location",
    "Test Location",
    "Unit/Room",
    "Room/Unit",
  ],

  // Unit Number variations (the apartment/unit identifier)
  unitNumber: [
    "Unit",
    "Unit #",
    "Unit Number",
    "Unit No",
    "Apt",
    "Apt #",
    "Apt No",
    "Apartment",
    "Apartment #",
    "Apartment Number",
    "Dwelling",
    "Dwelling Unit",
  ],

  // Room Type variations (include truncated e.g. ROOM TY)
  roomType: [
    "Room Type",
    "ROOM TY",
    "RoomType",
    "Room",
    "Room Name",
    "Area",
    "Area Type",
    "Space",
    "Space Type",
  ],

  // Room Number variations (the room # within a unit, e.g., Bedroom 1, Bedroom 2)
  roomNumber: [
    "Room Number",
    "Room #",
    "Room Num",  // Pb200i / Viken
    "Room No",
    "Rm #",
    "Rm No",
    "Number",
    "#",
  ],

  // Substrate variations (include truncated e.g. SUBSTRAT)
  substrate: [
    "Substrate",
    "SUBSTRAT",
    "Subtrate", // Common typo
    "Surface",
    "Material",
    "Substrate Type",
    "Surface Type",
    "Base Material",
  ],

  // Side variations
  side: [
    "Side",
    "SIDE",
    "Surface Side",
    "A/B",
    "Face",
  ],

  // Condition variations (include truncated e.g. CONDITIO)
  condition: [
    "Condition",
    "CONDITIO",
    "CONDITION",
    "Paint Condition",
    "Surface Condition",
    "Coating Condition",
  ],

  // Timestamp variations
  timestamp: [
    "Date",
    "Time",
    "DateTime",
    "Timestamp",
    "Reading Date",
    "Test Date",
    "Date/Time",
  ],
};

/**
 * Find matching column in Excel headers (case-insensitive).
 * Tries exact match first, then prefix match so truncated headers (e.g. COMPONE, SUBSTRAT) still match.
 */
export function findColumnMatch(
  headers: string[],
  possibleNames: string[]
): string | undefined {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  // 1. Exact match
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().trim();
    const index = normalizedHeaders.indexOf(normalizedName);
    if (index !== -1) {
      return headers[index];
    }
  }

  // 2. Prefix match: header truncated (e.g. "COMPONE" vs "Component") or name is prefix of header
  const MIN_PREFIX_LEN = 4;
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const h = normalizedHeaders[i];
    if (!h) continue;
    for (const name of possibleNames) {
      const n = name.toLowerCase().trim();
      if (h.length < MIN_PREFIX_LEN && n.length < MIN_PREFIX_LEN) continue;
      if (n.startsWith(h) || h.startsWith(n)) {
        return headers[i];
      }
    }
  }

  return undefined;
}

/**
 * Get all headers that weren't mapped to known columns
 * Useful for debugging/discovering new column names
 */
export function getUnmappedHeaders(
  headers: string[],
  mapping: IColumnMapping
): string[] {
  const allPossibleNames = [
    ...mapping.readingId,
    ...mapping.component,
    ...mapping.color,
    ...mapping.leadContent,
    ...mapping.location,
    ...mapping.unitNumber,
    ...mapping.roomType,
    ...mapping.roomNumber,
    ...mapping.substrate,
    ...mapping.side,
    ...mapping.condition,
    ...mapping.timestamp,
  ].map((n) => n.toLowerCase().trim());

  return headers.filter(
    (h) => !allPossibleNames.includes(h.toLowerCase().trim())
  );
}
