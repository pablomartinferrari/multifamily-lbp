/**
 * Represents a single XRF reading from the inspection device
 */
export interface IXrfReading {
  // === CRITICAL FIELDS ===
  /** Unique identifier for this reading */
  readingId: string;
  /** Raw component name from XRF device (e.g., "door jamb") */
  component: string;
  /** Paint color at reading location */
  color: string;
  /** Lead concentration in mg/cm² */
  leadContent: number;

  // === CALCULATED FIELDS (added by system) ===
  /** AI-normalized component name */
  normalizedComponent?: string;
  /** true if leadContent >= 1.0 mg/cm² */
  isPositive: boolean;

  // === LOCATION FIELDS ===
  /** Full location string (e.g., "Unit 101 - Bedroom 2") */
  location: string;
  /** Unit/Apartment number (e.g., "101", "A", "1") */
  unitNumber?: string;
  /** Room type (e.g., "Bedroom", "Kitchen", "Hallway", "Bathroom") */
  roomType?: string;
  /** Room number within the unit (e.g., "1", "2" for Bedroom 1, Bedroom 2) */
  roomNumber?: string;

  // === ADDITIONAL FIELDS ===
  /** Surface material (e.g., "Wood", "Metal", "Drywall") */
  substrate?: string;
  /** Side indicator (e.g., "A", "B" for doors) */
  side?: string;
  /** Paint condition (e.g., "Intact", "Deteriorated") */
  condition?: string;
  /** When reading was taken */
  timestamp?: Date;

  // === RAW DATA ===
  /** Original Excel row data for debugging */
  rawRow?: Record<string, unknown>;
}

/**
 * Lead content threshold for positive classification (mg/cm²)
 * Per HUD/EPA guidelines
 */
export const LEAD_POSITIVE_THRESHOLD = 1.0;

/**
 * Summary statistics for a batch of readings
 */
export interface IReadingsSummary {
  totalReadings: number;
  positiveReadings: number;
  negativeReadings: number;
  uniqueComponents: number;
  uniqueLocations: number;
  averageLeadContent: number;
  maxLeadContent: number;
}
