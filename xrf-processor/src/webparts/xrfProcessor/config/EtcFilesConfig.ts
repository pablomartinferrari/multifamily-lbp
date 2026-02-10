/**
 * Configuration for the ETC Files SharePoint library used for job lookup.
 * When the user enters a job number, the app searches this library instead of the jobs API.
 *
 * Library URL: https://environmentatestingandconsu.sharepoint.com/sites/ETCFiles/Shared%20Documents/Forms/AllItems.aspx
 * Job folders live under ETC/Clients (not at library root) to avoid list view threshold.
 */
export const ETC_FILES_CONFIG = {
  /** Full URL to the ETC Files site (where "Shared Documents" / job folders live) */
  SITE_URL: "https://environmentatestingandconsu.sharepoint.com/sites/ETCFiles",
  /**
   * Document library title. Use "Documents" (common internal name) or "Shared Documents" (display name).
   * If job lookup returns no results, try changing this to "Shared Documents".
   */
  LIBRARY_TITLE: "Documents",
  /**
   * Folder path under the library where job folders live (e.g. ETC/Clients/ClientName/Year/JobNumber_Address).
   * Scoping the query to this path avoids the list view threshold (5000 items) on the whole library.
   */
  ROOT_FOLDER_PATH: "Shared Documents/ETC/Clients",
} as const;
