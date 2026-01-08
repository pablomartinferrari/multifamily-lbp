# BB-03: SharePoint Service (PnP JS)

> **Priority**: 🔴 Critical  
> **Estimated Effort**: 3-4 hours  
> **Dependencies**: BB-01, BB-02  
> **Status**: ✅ Complete

---

## Objective

Create a SharePoint service layer using PnP JS to handle all CRUD operations for the XRF libraries and lists.

---

## Prerequisites

- BB-01 completed (SPFx project with PnP JS)
- BB-02 completed (SharePoint libraries created)

---

## Tasks

### 1. Create Type Definitions

Create `src/models/SharePointTypes.ts`:

```typescript
// ============================================
// SharePoint Library Item Types
// ============================================

export interface ISourceFileItem {
	Id: number;
	Title: string;
	JobNumber: string;
	AreaType: "Units" | "Common Areas";
	ProcessedStatus: "Pending" | "Complete" | "Error";
	ProcessedResultsLink?: {
		Url: string;
		Description: string;
	};
	Created: string;
	Modified: string;
}

export interface IProcessedResultItem {
	Id: number;
	Title: string;
	JobNumber: string;
	AreaType: "Units" | "Common Areas";
	SourceFileLink?: {
		Url: string;
		Description: string;
	};
	TotalReadings: number;
	UniqueComponents: number;
	LeadPositiveCount: number;
	LeadPositivePercent: number;
	Created: string;
}

export interface IComponentCacheItem {
	Id: number;
	Title: string; // Original component name
	NormalizedName: string;
	Confidence: number;
	Source: "AI" | "Manual";
	UsageCount: number;
	LastUsed: string;
}

// ============================================
// Input Types (for creating/updating)
// ============================================

export interface ISourceFileMetadata {
	jobNumber: string;
	areaType: "Units" | "Common Areas";
}

export interface IProcessedResultMetadata {
	jobNumber: string;
	areaType: "Units" | "Common Areas";
	sourceFileUrl: string;
	totalReadings: number;
	uniqueComponents: number;
	leadPositiveCount: number;
	leadPositivePercent: number;
}

export interface IComponentMapping {
	originalName: string;
	normalizedName: string;
	confidence: number;
	source: "AI" | "Manual";
}
```

### 2. Create Constants File

Create `src/constants/LibraryNames.ts`:

```typescript
export const LIBRARY_NAMES = {
	SOURCE_FILES: "XRF-SourceFiles",
	PROCESSED_RESULTS: "XRF-ProcessedResults",
	COMPONENT_CACHE: "XRF-ComponentCache",
} as const;

export const FIELDS = {
	SOURCE_FILES: {
		JOB_NUMBER: "JobNumber",
		AREA_TYPE: "AreaType",
		PROCESSED_STATUS: "ProcessedStatus",
		PROCESSED_RESULTS_LINK: "ProcessedResultsLink",
	},
	PROCESSED_RESULTS: {
		JOB_NUMBER: "JobNumber",
		AREA_TYPE: "AreaType",
		SOURCE_FILE_LINK: "SourceFileLink",
		TOTAL_READINGS: "TotalReadings",
		UNIQUE_COMPONENTS: "UniqueComponents",
		LEAD_POSITIVE_COUNT: "LeadPositiveCount",
		LEAD_POSITIVE_PERCENT: "LeadPositivePercent",
	},
	COMPONENT_CACHE: {
		NORMALIZED_NAME: "NormalizedName",
		CONFIDENCE: "Confidence",
		SOURCE: "Source",
		USAGE_COUNT: "UsageCount",
		LAST_USED: "LastUsed",
	},
} as const;
```

### 3. Create SharePoint Service

Create `src/services/SharePointService.ts`:

```typescript
import { SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/files";
import "@pnp/sp/folders";

import { LIBRARY_NAMES, FIELDS } from "../constants/LibraryNames";
import {
	ISourceFileItem,
	IProcessedResultItem,
	IComponentCacheItem,
	ISourceFileMetadata,
	IProcessedResultMetadata,
	IComponentMapping,
} from "../models/SharePointTypes";

export class SharePointService {
	private sp: SPFI;

	constructor(sp: SPFI) {
		this.sp = sp;
	}

	// ============================================
	// SOURCE FILES LIBRARY
	// ============================================

	/**
	 * Upload an Excel file to the Source Files library
	 */
	async uploadSourceFile(
		file: File,
		metadata: ISourceFileMetadata
	): Promise<{ fileUrl: string; itemId: number }> {
		const library = this.sp.web.lists.getByTitle(LIBRARY_NAMES.SOURCE_FILES);
		const folder = await library.rootFolder();

		// Upload file
		const fileBuffer = await file.arrayBuffer();
		const uploadResult = await this.sp.web
			.getFolderByServerRelativePath(folder.ServerRelativeUrl)
			.files.addUsingPath(file.name, fileBuffer, { Overwrite: true });

		// Get the list item associated with the file
		const fileItem = await this.sp.web
			.getFileByServerRelativePath(uploadResult.ServerRelativeUrl)
			.listItemAllFields();

		// Update metadata
		await library.items.getById(fileItem.Id).update({
			[FIELDS.SOURCE_FILES.JOB_NUMBER]: metadata.jobNumber,
			[FIELDS.SOURCE_FILES.AREA_TYPE]: metadata.areaType,
			[FIELDS.SOURCE_FILES.PROCESSED_STATUS]: "Pending",
		});

		return {
			fileUrl: uploadResult.ServerRelativeUrl,
			itemId: fileItem.Id,
		};
	}

	/**
	 * Update the processing status of a source file
	 */
	async updateSourceFileStatus(
		itemId: number,
		status: "Pending" | "Complete" | "Error",
		resultsUrl?: string
	): Promise<void> {
		const updateData: Record<string, unknown> = {
			[FIELDS.SOURCE_FILES.PROCESSED_STATUS]: status,
		};

		if (resultsUrl) {
			updateData[FIELDS.SOURCE_FILES.PROCESSED_RESULTS_LINK] = {
				Url: resultsUrl,
				Description: "View Results",
			};
		}

		await this.sp.web.lists
			.getByTitle(LIBRARY_NAMES.SOURCE_FILES)
			.items.getById(itemId)
			.update(updateData);
	}

	/**
	 * Get source files by job number
	 */
	async getSourceFilesByJob(jobNumber: string): Promise<ISourceFileItem[]> {
		return await this.sp.web.lists
			.getByTitle(LIBRARY_NAMES.SOURCE_FILES)
			.items.filter(`${FIELDS.SOURCE_FILES.JOB_NUMBER} eq '${jobNumber}'`)
			.select(
				"Id",
				"Title",
				"JobNumber",
				"AreaType",
				"ProcessedStatus",
				"ProcessedResultsLink",
				"Created",
				"Modified"
			)();
	}

	// ============================================
	// PROCESSED RESULTS LIBRARY
	// ============================================

	/**
	 * Save processed results (JSON summary) to the library
	 */
	async saveProcessedResults(
		summaryJson: string,
		fileName: string,
		metadata: IProcessedResultMetadata
	): Promise<{ fileUrl: string; itemId: number }> {
		const library = this.sp.web.lists.getByTitle(
			LIBRARY_NAMES.PROCESSED_RESULTS
		);
		const folder = await library.rootFolder();

		// Upload JSON file
		const encoder = new TextEncoder();
		const fileBuffer = encoder.encode(summaryJson);

		const uploadResult = await this.sp.web
			.getFolderByServerRelativePath(folder.ServerRelativeUrl)
			.files.addUsingPath(fileName, fileBuffer, { Overwrite: true });

		// Get the list item
		const fileItem = await this.sp.web
			.getFileByServerRelativePath(uploadResult.ServerRelativeUrl)
			.listItemAllFields();

		// Update metadata
		await library.items.getById(fileItem.Id).update({
			[FIELDS.PROCESSED_RESULTS.JOB_NUMBER]: metadata.jobNumber,
			[FIELDS.PROCESSED_RESULTS.AREA_TYPE]: metadata.areaType,
			[FIELDS.PROCESSED_RESULTS.SOURCE_FILE_LINK]: {
				Url: metadata.sourceFileUrl,
				Description: "Source File",
			},
			[FIELDS.PROCESSED_RESULTS.TOTAL_READINGS]: metadata.totalReadings,
			[FIELDS.PROCESSED_RESULTS.UNIQUE_COMPONENTS]: metadata.uniqueComponents,
			[FIELDS.PROCESSED_RESULTS.LEAD_POSITIVE_COUNT]:
				metadata.leadPositiveCount,
			[FIELDS.PROCESSED_RESULTS.LEAD_POSITIVE_PERCENT]:
				metadata.leadPositivePercent,
		});

		return {
			fileUrl: uploadResult.ServerRelativeUrl,
			itemId: fileItem.Id,
		};
	}

	/**
	 * Get processed results by job number
	 */
	async getProcessedResultsByJob(
		jobNumber: string
	): Promise<IProcessedResultItem[]> {
		return await this.sp.web.lists
			.getByTitle(LIBRARY_NAMES.PROCESSED_RESULTS)
			.items.filter(`${FIELDS.PROCESSED_RESULTS.JOB_NUMBER} eq '${jobNumber}'`)
			.select(
				"Id",
				"Title",
				"JobNumber",
				"AreaType",
				"SourceFileLink",
				"TotalReadings",
				"UniqueComponents",
				"LeadPositiveCount",
				"LeadPositivePercent",
				"Created"
			)();
	}

	/**
	 * Get processed result JSON content
	 */
	async getProcessedResultContent(fileUrl: string): Promise<string> {
		const file = this.sp.web.getFileByServerRelativePath(fileUrl);
		const content = await file.getText();
		return content;
	}

	// ============================================
	// COMPONENT CACHE LIST
	// ============================================

	/**
	 * Get all cached component mappings
	 */
	async getComponentCache(): Promise<IComponentCacheItem[]> {
		return await this.sp.web.lists
			.getByTitle(LIBRARY_NAMES.COMPONENT_CACHE)
			.items.select(
				"Id",
				"Title",
				"NormalizedName",
				"Confidence",
				"Source",
				"UsageCount",
				"LastUsed"
			)
			.top(5000)(); // Get all cached items
	}

	/**
	 * Get cached mappings for specific component names
	 */
	async getCachedMappings(
		componentNames: string[]
	): Promise<Map<string, IComponentCacheItem>> {
		const cache = new Map<string, IComponentCacheItem>();

		if (componentNames.length === 0) return cache;

		// Build filter for batch query
		const filterParts = componentNames.map(
			(name) => `Title eq '${name.replace(/'/g, "''")}'`
		);

		// SharePoint has URL length limits, so batch if needed
		const batchSize = 50;
		for (let i = 0; i < filterParts.length; i += batchSize) {
			const batch = filterParts.slice(i, i + batchSize);
			const filter = batch.join(" or ");

			const items: IComponentCacheItem[] = await this.sp.web.lists
				.getByTitle(LIBRARY_NAMES.COMPONENT_CACHE)
				.items.filter(filter)
				.select(
					"Id",
					"Title",
					"NormalizedName",
					"Confidence",
					"Source",
					"UsageCount",
					"LastUsed"
				)();

			items.forEach((item) => cache.set(item.Title.toLowerCase(), item));
		}

		return cache;
	}

	/**
	 * Add or update component mappings in cache
	 */
	async updateComponentCache(mappings: IComponentMapping[]): Promise<void> {
		const list = this.sp.web.lists.getByTitle(LIBRARY_NAMES.COMPONENT_CACHE);
		const today = new Date().toISOString();

		for (const mapping of mappings) {
			// Check if exists
			const existing = await list.items
				.filter(`Title eq '${mapping.originalName.replace(/'/g, "''")}'`)
				.select("Id", "UsageCount")();

			if (existing.length > 0) {
				// Update existing
				await list.items.getById(existing[0].Id).update({
					[FIELDS.COMPONENT_CACHE.NORMALIZED_NAME]: mapping.normalizedName,
					[FIELDS.COMPONENT_CACHE.CONFIDENCE]: mapping.confidence,
					[FIELDS.COMPONENT_CACHE.SOURCE]: mapping.source,
					[FIELDS.COMPONENT_CACHE.USAGE_COUNT]:
						(existing[0].UsageCount || 0) + 1,
					[FIELDS.COMPONENT_CACHE.LAST_USED]: today,
				});
			} else {
				// Create new
				await list.items.add({
					Title: mapping.originalName,
					[FIELDS.COMPONENT_CACHE.NORMALIZED_NAME]: mapping.normalizedName,
					[FIELDS.COMPONENT_CACHE.CONFIDENCE]: mapping.confidence,
					[FIELDS.COMPONENT_CACHE.SOURCE]: mapping.source,
					[FIELDS.COMPONENT_CACHE.USAGE_COUNT]: 1,
					[FIELDS.COMPONENT_CACHE.LAST_USED]: today,
				});
			}
		}
	}

	/**
	 * Increment usage count for cached mappings
	 */
	async incrementCacheUsage(originalNames: string[]): Promise<void> {
		const list = this.sp.web.lists.getByTitle(LIBRARY_NAMES.COMPONENT_CACHE);
		const today = new Date().toISOString();

		for (const name of originalNames) {
			const items = await list.items
				.filter(`Title eq '${name.replace(/'/g, "''")}'`)
				.select("Id", "UsageCount")();

			if (items.length > 0) {
				await list.items.getById(items[0].Id).update({
					[FIELDS.COMPONENT_CACHE.USAGE_COUNT]: (items[0].UsageCount || 0) + 1,
					[FIELDS.COMPONENT_CACHE.LAST_USED]: today,
				});
			}
		}
	}
}
```

### 4. Create Service Factory

Create `src/services/ServiceFactory.ts`:

```typescript
import { SPFI } from "@pnp/sp";
import { SharePointService } from "./SharePointService";

let sharePointService: SharePointService | null = null;

export function initializeServices(sp: SPFI): void {
	sharePointService = new SharePointService(sp);
}

export function getSharePointService(): SharePointService {
	if (!sharePointService) {
		throw new Error(
			"SharePointService not initialized. Call initializeServices first."
		);
	}
	return sharePointService;
}
```

### 5. Write Unit Tests

Create `src/services/SharePointService.test.ts`:

```typescript
import { SharePointService } from "./SharePointService";

// Mock PnP SP
const mockSp = {
	web: {
		lists: {
			getByTitle: jest.fn(),
		},
		getFolderByServerRelativePath: jest.fn(),
		getFileByServerRelativePath: jest.fn(),
	},
};

describe("SharePointService", () => {
	let service: SharePointService;

	beforeEach(() => {
		service = new SharePointService(mockSp as any);
		jest.clearAllMocks();
	});

	describe("getComponentCache", () => {
		it("should return all cached items", async () => {
			const mockItems = [
				{
					Id: 1,
					Title: "door jamb",
					NormalizedName: "Door Jamb",
					Confidence: 0.95,
				},
				{
					Id: 2,
					Title: "window sill",
					NormalizedName: "Window Sill",
					Confidence: 0.98,
				},
			];

			mockSp.web.lists.getByTitle.mockReturnValue({
				items: {
					select: () => ({
						top: () => Promise.resolve(mockItems),
					}),
				},
			});

			const result = await service.getComponentCache();
			expect(result).toEqual(mockItems);
		});
	});

	// Add more tests...
});
```

---

## Acceptance Criteria

- [ ] SharePointService class created with all methods
- [ ] Can upload file to XRF-SourceFiles with metadata
- [ ] Can save JSON to XRF-ProcessedResults with metadata
- [ ] Can read/write component cache
- [ ] Can link source files to results
- [ ] Error handling implemented
- [ ] TypeScript types defined for all SharePoint items

---

## Output Artifacts

```
src/
├── constants/
│   └── LibraryNames.ts
├── models/
│   └── SharePointTypes.ts
├── services/
│   ├── SharePointService.ts
│   ├── SharePointService.test.ts
│   └── ServiceFactory.ts
```

---

## API Reference

| Method                                                | Description                            |
| ----------------------------------------------------- | -------------------------------------- |
| `uploadSourceFile(file, metadata)`                    | Upload Excel file with job metadata    |
| `updateSourceFileStatus(itemId, status, resultsUrl?)` | Update processing status               |
| `getSourceFilesByJob(jobNumber)`                      | Get all source files for a job         |
| `saveProcessedResults(json, fileName, metadata)`      | Save summary JSON                      |
| `getProcessedResultsByJob(jobNumber)`                 | Get results for a job                  |
| `getProcessedResultContent(fileUrl)`                  | Get JSON content                       |
| `getComponentCache()`                                 | Get all cached normalizations          |
| `getCachedMappings(names)`                            | Get cached mappings for specific names |
| `updateComponentCache(mappings)`                      | Add/update cache entries               |
| `incrementCacheUsage(names)`                          | Increment usage counters               |

---

## Next Steps

Once this building block is complete:

1. ➡️ Proceed to **BB-04: Excel Parser Service**
2. The Excel parser will produce data that gets saved via this service
