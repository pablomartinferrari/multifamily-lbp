# BB-01: SPFx Project Setup & Infrastructure Test

> **Priority**: 🔴 Critical (Start Here)  
> **Estimated Effort**: 2-4 hours  
> **Dependencies**: None  
> **Status**: ✅ Complete

---

## Objective

Create the SPFx project foundation and validate SharePoint connectivity early to avoid integration issues later.

---

## Prerequisites

- Node.js 18.x LTS installed
- Access to SharePoint Online site
- SharePoint Admin or Site Owner permissions
- Code editor (VS Code recommended)

---

## Tasks

### 1. Install Development Tools

```bash
# Verify Node.js version
node --version  # Should be 18.x

# Install SPFx toolchain globally
npm install -g yo @microsoft/generator-sharepoint gulp-cli

# Verify installations
yo --version
gulp --version
```

### 2. Create SPFx Project

```bash
# Navigate to project directory
cd c:\dev\etc\multifamily-lbp

# Run Yeoman generator
yo @microsoft/sharepoint
```

**Prompts:**
| Prompt | Value |
|--------|-------|
| Solution name | xrf-processor |
| Target | SharePoint Online only |
| Where to place files | Current folder |
| Tenant admin deploy | No |
| Component type | WebPart |
| Web part name | XrfProcessor |
| Description | XRF Lead Paint Inspection Data Processor |
| Framework | React |

### 3. Install Dependencies

```bash
# PnP JS for SharePoint operations
npm install @pnp/sp @pnp/logging --save

# PnP SPFx Controls for UI components
npm install @pnp/spfx-controls-react --save

# SheetJS for Excel parsing
npm install xlsx --save

# TypeScript types
npm install @types/react @types/react-dom --save-dev
```

### 4. Configure PnP JS

Create/update `src/webparts/xrfProcessor/XrfProcessorWebPart.ts`:

```typescript
import { spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/files";
import "@pnp/sp/folders";

// In onInit() method:
protected async onInit(): Promise<void> {
  await super.onInit();

  // Initialize PnP JS
  const sp = spfi().using(SPFx(this.context));

  // Store for use in components
  // (pass via props or context)
}
```

### 5. Create Infrastructure Test

Create `src/webparts/xrfProcessor/services/ConnectionTest.ts`:

```typescript
import { SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";

export interface IConnectionTestResult {
	success: boolean;
	canRead: boolean;
	canWrite: boolean;
	error?: string;
	details?: string;
}

export async function testSharePointConnection(
	sp: SPFI
): Promise<IConnectionTestResult> {
	const result: IConnectionTestResult = {
		success: false,
		canRead: false,
		canWrite: false,
	};

	try {
		// Test 1: Read - Get web info
		const web = await sp.web();
		console.log("✅ Read successful - Web title:", web.Title);
		result.canRead = true;

		// Test 2: Read - List all lists
		const lists = await sp.web.lists();
		console.log("✅ Found", lists.length, "lists");

		// Test 3: Write - Create and delete test item
		// Only if XRF-SourceFiles exists (created in BB-02)
		try {
			const list = sp.web.lists.getByTitle("XRF-SourceFiles");
			const addResult = await list.items.add({
				Title: `Connection Test - ${new Date().toISOString()}`,
			});
			console.log("✅ Write successful - Item ID:", addResult.Id);

			// Clean up test item
			await list.items.getById(addResult.Id).delete();
			console.log("✅ Delete successful");

			result.canWrite = true;
		} catch (writeError) {
			console.log("⚠️ Write test skipped - XRF-SourceFiles may not exist yet");
			result.details =
				"Write test skipped - create SharePoint libraries first (BB-02)";
		}

		result.success = result.canRead;
		return result;
	} catch (error) {
		console.error("❌ Connection test failed:", error);
		result.error = error instanceof Error ? error.message : String(error);
		return result;
	}
}
```

### 6. Add Test Button to Web Part

Update `src/webparts/xrfProcessor/components/XrfProcessor.tsx`:

```typescript
import * as React from "react";
import { PrimaryButton, MessageBar, MessageBarType } from "@fluentui/react";
import {
	testSharePointConnection,
	IConnectionTestResult,
} from "../services/ConnectionTest";

interface IXrfProcessorProps {
	sp: SPFI;
}

const XrfProcessor: React.FC<IXrfProcessorProps> = ({ sp }) => {
	const [testResult, setTestResult] =
		React.useState<IConnectionTestResult | null>(null);
	const [testing, setTesting] = React.useState(false);

	const handleTestConnection = async () => {
		setTesting(true);
		const result = await testSharePointConnection(sp);
		setTestResult(result);
		setTesting(false);
	};

	return (
		<div>
			<h2>XRF Processor - Infrastructure Test</h2>

			<PrimaryButton
				text={testing ? "Testing..." : "Test SharePoint Connection"}
				onClick={handleTestConnection}
				disabled={testing}
			/>

			{testResult && (
				<div style={{ marginTop: 16 }}>
					<MessageBar
						messageBarType={
							testResult.success ? MessageBarType.success : MessageBarType.error
						}
					>
						{testResult.success
							? "Connection successful!"
							: "Connection failed"}
					</MessageBar>

					<ul>
						<li>Can Read: {testResult.canRead ? "✅" : "❌"}</li>
						<li>Can Write: {testResult.canWrite ? "✅" : "❌"}</li>
						{testResult.error && <li>Error: {testResult.error}</li>}
						{testResult.details && <li>Details: {testResult.details}</li>}
					</ul>
				</div>
			)}
		</div>
	);
};

export default XrfProcessor;
```

### 7. Test in Workbench

```bash
# Start local development server
gulp serve

# Opens browser to: https://localhost:4321/temp/workbench.html
# Use SharePoint workbench instead: https://[tenant].sharepoint.com/_layouts/15/workbench.aspx
```

---

## Acceptance Criteria

- [ ] `gulp serve` launches without errors
- [ ] Web part renders in SharePoint workbench
- [ ] "Test Connection" button works
- [ ] Can read from SharePoint (lists, web info)
- [ ] Console shows successful read operations

---

## Output Artifacts

```
src/
├── webparts/
│   └── xrfProcessor/
│       ├── XrfProcessorWebPart.ts       # Web part with PnP JS setup
│       ├── components/
│       │   └── XrfProcessor.tsx         # Main component with test button
│       └── services/
│           └── ConnectionTest.ts        # Infrastructure test utility
```

---

## Common Issues & Solutions

### Issue: "gulp serve" fails with Node version error

**Solution**: Ensure Node.js 18.x is installed. Use nvm to switch versions if needed.

### Issue: CORS errors in browser

**Solution**: Use SharePoint workbench (not local workbench) for testing with real SharePoint data.

### Issue: "Access denied" errors

**Solution**: Verify you have at least Contribute permissions on the SharePoint site.

### Issue: PnP JS not initialized

**Solution**: Ensure `spfi().using(SPFx(this.context))` is called in `onInit()`.

---

## Next Steps

Once this building block is complete:

1. ➡️ Proceed to **BB-02: SharePoint Libraries Setup**
2. Come back and re-run the write test after libraries are created
