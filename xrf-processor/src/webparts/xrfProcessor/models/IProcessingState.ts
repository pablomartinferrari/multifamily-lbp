/**
 * Processing pipeline steps
 */
export type ProcessingStep =
  | "IDLE"
  | "UPLOADING"
  | "PARSING"
  | "NORMALIZING"
  | "REVIEWING"
  | "EDITING"      // Review and edit parsed data
  | "EDITING_COMPLETE"  // User marked step complete; offer upload other type or generate report
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
  EDITING_COMPLETE: "Choose next step",
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
  EDITING_COMPLETE: 72,
  SUMMARIZING: 80,
  STORING: 90,
  COMPLETE: 100,
  ERROR: 0,
};
