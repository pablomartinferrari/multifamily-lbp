/**
 * Result of looking up a job (e.g. in ETC Files SharePoint library).
 * Used to validate and display job info when the user enters a job number.
 */
/* eslint-disable @rushstack/no-new-null -- optional fields use null for "not found" */

export interface IJobLookupResult {
  /** Job number / ID as entered (string for display and flexibility) */
  jobId: string;
  /** Full folder name (e.g. "275658_35246 Pinetree St., Livonia, MI 48150") */
  displayName?: string | null;
  /** Client name (parent of parent folder in ETC Files) */
  client?: { name: string } | null;
  facilityName?: string | null;
  /** Address parsed from folder name (part after "jobNumber_") */
  facilityAddress?: string | null;
  /** Optional link to the job folder in ETC Files */
  folderUrl?: string | null;
  /** Year folder (parent folder); optional, for display */
  year?: string | null;
}
