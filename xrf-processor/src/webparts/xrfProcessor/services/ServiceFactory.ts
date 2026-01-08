import { SPFI } from "@pnp/sp";
import { SharePointService } from "./SharePointService";

let spInstance: SPFI | undefined = undefined;
let sharePointService: SharePointService | undefined = undefined;

/**
 * Initialize services with the PnP SP instance
 * Call this once from your web part's onInit
 */
export function initializeServices(sp: SPFI): void {
  spInstance = sp;
  sharePointService = new SharePointService(sp);
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
