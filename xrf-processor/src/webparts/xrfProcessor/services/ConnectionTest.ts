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
    } catch {
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

