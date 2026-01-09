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

  // Component variations
  component: [
    "Component",
    "Building Component",
    "Comp",
    "Component Type",
    "Testing Component",
    "Substrate Component",
    "Test Component",
    "Element",
  ],

  // Color variations
  color: [
    "Color",
    "Paint Color",
    "Colour",
    "Surface Color",
    "Coating Color",
  ],

  // Lead content variations (mg/cm²)
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
    "mg/cm²",
    "mg/cm2",
    "Result",
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

  // Room Type variations (Bedroom, Kitchen, etc.)
  roomType: [
    "Room Type",
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
    "Room No",
    "Rm #",
    "Rm No",
    "Number",
    "#",
  ],

  // Substrate variations
  substrate: [
    "Substrate",
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
    "Surface Side",
    "A/B",
    "Face",
  ],

  // Condition variations
  condition: [
    "Condition",
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
 * Find matching column in Excel headers (case-insensitive)
 * @param headers - Array of column headers from Excel
 * @param possibleNames - Array of possible column name variations
 * @returns The matching header name or undefined if not found
 */
export function findColumnMatch(
  headers: string[],
  possibleNames: string[]
): string | undefined {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().trim();
    const index = normalizedHeaders.indexOf(normalizedName);
    if (index !== -1) {
      return headers[index]; // Return original case
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
