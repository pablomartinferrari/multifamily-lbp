/**
 * Processing pipeline steps
 */
export type ProcessingStep =
  | "IDLE"
  | "UPLOADING"
  | "PARSING"
  | "NORMALIZING"
  | "REVIEWING"
  | "EDITING"      // New: Review and edit parsed data
  | "SUMMARIZING"
  | "STORING"
  | "COMPLETE"
  | "ERROR";

/**
 * Current processing state
 */
export interface IProcessingState {
  /** Current step in the pipeline */
  step: ProcessingStep;
  /** Progress percentage (0-100) */
  progress: number;
  /** User-facing status message */
  message: string;
  /** Error message if step is ERROR */
  error?: string;
}

/**
 * Initial/reset state
 */
export const INITIAL_PROCESSING_STATE: IProcessingState = {
  step: "IDLE",
  progress: 0,
  message: "",
};

/**
 * Step descriptions for progress display
 */
export const STEP_DESCRIPTIONS: Record<ProcessingStep, string> = {
  IDLE: "Ready to process",
  UPLOADING: "Uploading file...",
  PARSING: "Parsing Excel/CSV data...",
  NORMALIZING: "Normalizing component names with AI...",
  REVIEWING: "Review AI suggestions",
  EDITING: "Review and edit data",
  SUMMARIZING: "Generating HUD/EPA summary...",
  STORING: "Saving results to SharePoint...",
  COMPLETE: "Processing complete!",
  ERROR: "An error occurred",
};

/**
 * Progress percentages for each step
 */
export const STEP_PROGRESS: Record<ProcessingStep, number> = {
  IDLE: 0,
  UPLOADING: 10,
  PARSING: 25,
  NORMALIZING: 40,
  REVIEWING: 55,
  EDITING: 70,
  SUMMARIZING: 80,
  STORING: 90,
  COMPLETE: 100,
  ERROR: 0,
};
