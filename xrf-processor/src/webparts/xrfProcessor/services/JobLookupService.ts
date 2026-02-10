import { SPHttpClient } from "@microsoft/sp-http";
import { ETC_FILES_CONFIG } from "../config/EtcFilesConfig";
import type { IJobLookupResult } from "../models/IJobLookup";

/** SPFx context shape needed for search (current site URL + spHttpClient) */
export interface IJobLookupContext {
  pageContext: { web: { absoluteUrl: string } };
  spHttpClient: SPHttpClient;
}

/** One row of search results (Cells array) */
interface ISearchRow {
  Cells?: { results?: Array<{ Key: string; Value?: string }> } | Array<{ Key: string; Value?: string }>;
}

/** SharePoint Search postquery response - may be under d.query or at top level */
interface ISearchResponse {
  d?: { query?: Record<string, unknown> };
  PrimaryQueryResult?: {
    RelevantResults?: {
      Table?: { Rows?: { results?: ISearchRow[] } | ISearchRow[] };
    };
  };
}

/**
 * Service to look up jobs by job number using the SharePoint Search API.
 * Search is tenant-wide and not subject to the list view threshold.
 * Runs the query from the current site so auth works when calling a different site in the tenant.
 */
export class JobLookupService {
  private context: IJobLookupContext;

  constructor(context: IJobLookupContext) {
    this.context = context;
  }

  /**
   * Find a job folder under ETC/Clients whose name starts with "{jobNumber}_" using Search API.
   */
  // eslint-disable-next-line @rushstack/no-new-null -- contract uses null for "not found"
  async findJobByJobNumber(jobNumberInput: string): Promise<IJobLookupResult | null> {
    const trimmed = jobNumberInput.trim();
    if (!trimmed) return null;

    const searchPath = `${ETC_FILES_CONFIG.SITE_URL}/${ETC_FILES_CONFIG.ROOT_FOLDER_PATH}`.replace(
      /\/+/g,
      "/"
    );
    const queryText = `${trimmed}_`;

    // Search by title only (folder name = job number + address); scope to ETC/Clients folders.
    const request = {
      request: {
        Querytext: queryText,
        QueryTemplate: `Path:"${searchPath}" contentclass:STS_Folder Title:"{searchTerms}*"`,
        RowLimit: 5,
        SelectProperties: ["Title", "Path"],
      },
    };

    try {
      const postUrl = `${this.context.pageContext.web.absoluteUrl}/_api/search/postquery`;
      if (typeof console !== "undefined" && console.debug) {
        console.debug("[JobLookup] Searching ETC Files for job:", trimmed, "POST", postUrl);
      }
      const response = await this.context.spHttpClient.post(
        postUrl,
        SPHttpClient.configurations.v1,
        {
          body: JSON.stringify(request),
          headers: { "Content-Type": "application/json;odata=verbose" },
        }
      );

      if (!response.ok) {
        const errText = typeof (response as { text: () => Promise<string> }).text === "function"
          ? await (response as { text: () => Promise<string> }).text()
          : String(response.status);
        throw new Error(`Search API error: ${response.status} ${errText}`);
      }

      const raw = (await response.json()) as { d?: { query?: ISearchResponse } } & ISearchResponse;
      const data: ISearchResponse = raw.d?.query ?? raw;
      const rows = data?.PrimaryQueryResult?.RelevantResults?.Table?.Rows;
      const rowArray: unknown[] = Array.isArray(rows)
        ? rows
        : rows && typeof rows === "object" && "results" in rows
          ? Array.isArray((rows as { results?: unknown[] }).results)
            ? (rows as { results: unknown[] }).results
            : []
          : [];
      if (rowArray.length === 0) return null;

      type SearchCell = { Key: string; Value?: string };
      const getCell = (row: ISearchRow, key: string): string | undefined => {
        const rawCells = row?.Cells && "results" in row.Cells ? (row.Cells as { results?: SearchCell[] }).results : row?.Cells;
        const cells: SearchCell[] = Array.isArray(rawCells) ? (rawCells as SearchCell[]) : [];
        const c = cells.find((x) => x.Key === key);
        return c?.Value;
      };

      const isFilePath = (pathStr: string): boolean => /\.[a-z0-9]{2,5}$/i.test(pathStr.trim());

      let firstRow: ISearchRow | null = null;
      for (let i = 0; i < rowArray.length; i++) {
        const row = rowArray[i] as ISearchRow;
        const title = getCell(row, "Title") ?? getCell(row, "Filename") ?? "";
        const path = getCell(row, "Path") ?? "";
        if (!title.startsWith(queryText)) continue;
        if (!path) continue;
        if (!isFilePath(path)) {
          firstRow = row;
          break;
        }
      }
      if (!firstRow) {
        const row = rowArray[0] as ISearchRow;
        const title = getCell(row, "Title") ?? getCell(row, "Filename") ?? "";
        if (title.startsWith(queryText)) firstRow = row;
      }
      if (!firstRow) return null;

      const title = getCell(firstRow, "Title") ?? getCell(firstRow, "Filename") ?? "";
      const path = getCell(firstRow, "Path") ?? "";

      const origin = new URL(ETC_FILES_CONFIG.SITE_URL).origin;
      const folderUrl = path.startsWith("http") ? path : path.startsWith("/") ? `${origin}${path}` : undefined;

      const address = title.includes("_") ? title.replace(/^[^_]+_/, "").trim() : "";
      const pathParts = path.replace(/^https?:\/\/[^/]+/, "").split("/").filter((p) => p.length > 0);
      const year = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : undefined;
      const clientName = pathParts.length >= 3 ? pathParts[pathParts.length - 3] : undefined;

      return {
        jobId: trimmed,
        displayName: title,
        client: clientName ? { name: clientName } : undefined,
        facilityName: address || undefined,
        facilityAddress: address || undefined,
        folderUrl: folderUrl ?? undefined,
        year,
      };
    } catch (error) {
      console.error("JobLookupService.findJobByJobNumber error:", error);
      throw error;
    }
  }
}

let jobLookupServiceInstance: JobLookupService | undefined;

export function getJobLookupService(): JobLookupService {
  if (!jobLookupServiceInstance) {
    throw new Error(
      "JobLookupService not initialized. Call initializeServices with SPFx context."
    );
  }
  return jobLookupServiceInstance;
}

export function setJobLookupService(service: JobLookupService): void {
  jobLookupServiceInstance = service;
}
