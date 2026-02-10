import { SPFI } from "@pnp/sp";
import { SharePointService } from "./SharePointService";
import { JobLookupService, setJobLookupService, type IJobLookupContext } from "./JobLookupService";

let spInstance: SPFI | undefined = undefined;
let sharePointService: SharePointService | undefined = undefined;

/** SPFx context (web part or extension) for job lookup via Search API */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SPFxContext = any;

/**
 * Initialize services with the PnP SP instance and optional SPFx context.
 * When context is provided, job lookup uses the SharePoint Search API (tenant-wide)
 * so we avoid list view threshold when querying the ETC Files site.
 * Call this once from your web part's onInit.
 */
export function initializeServices(sp: SPFI, context?: SPFxContext): void {
  spInstance = sp;
  sharePointService = new SharePointService(sp);

  if (context) {
    setJobLookupService(new JobLookupService(context as IJobLookupContext));
  }
}

/**
 * Get the SharePoint service instance
 * @throws Error if services not initialized
 */
export function getSharePointService(): SharePointService {
  if (!sharePointService) {
    throw new Error("SharePointService not initialized. Call initializeServices first.");
  }
  return sharePointService;
}

/**
 * Get the raw PnP SP instance for direct queries
 * @throws Error if services not initialized
 */
export function getSP(): SPFI {
  if (!spInstance) {
    throw new Error("SP not initialized. Call initializeServices first.");
  }
  return spInstance;
}

/**
 * Check if services have been initialized
 */
export function isInitialized(): boolean {
  return spInstance !== undefined && sharePointService !== undefined;
}
