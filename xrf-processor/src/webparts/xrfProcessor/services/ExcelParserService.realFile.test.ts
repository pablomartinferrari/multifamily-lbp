/**
 * One-off test: run the parser on the real "Multi family flip 1-9-26 2.xlsx" file
 * and compare rows processed vs expected. The file may have ~5710 data rows in Excel;
 * the parser only sees rows that SheetJS loads (sheet range). We assert that every
 * row the parser sees is either a valid reading, a recorded error, or skipped (no silent drops).
 */
import * as fs from "fs";
import * as path from "path";
import { ExcelParserService } from "./ExcelParserService";

const REAL_FILE = "Multi family flip 1-9-26 2.xlsx";

function getDataFilePath(): string {
  const possibleRoots = [
    path.join(process.cwd(), "..", "data", REAL_FILE),
    path.join(process.cwd(), "data", REAL_FILE),
    path.join(__dirname, "..", "..", "..", "..", "data", REAL_FILE),
  ];
  for (const p of possibleRoots) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Data file not found. Tried: ${possibleRoots.join(", ")}`);
}

describe("ExcelParserService - real file Multi family flip 1-9-26 2.xlsx", () => {
  let filePath: string;

  beforeAll(() => {
    filePath = getDataFilePath();
  });

  it("processes all rows seen by parser (readings + errors + skipped = total) and reports counts", async () => {
    const buffer = fs.readFileSync(filePath);
    const arrayBuffer = new Uint8Array(buffer).buffer;

    const service = new ExcelParserService();
    const result = await service.parseFile(arrayBuffer);

    const totalRowsInFile = result.metadata.totalRows;
    const validReadings = result.readings.length;
    const errorCount = result.errors.length;
    const skipped = result.metadata.skippedRows;
    const expectedDataRowsIfFull = 5710;
    const cal = result.metadata.skippedCalibration ?? 0;
    const junk = result.metadata.skippedJunk ?? 0;
    const reasons = result.metadata.skippedJunkReasons;

    // Log for comparison
    console.log("--- Real file parse result ---");
    console.log("File:", REAL_FILE);
    console.log("Total data rows in sheet (parser saw):", totalRowsInFile);
    console.log("Valid readings (added to grid):", validReadings);
    console.log("Rows with parse errors:", errorCount);
    console.log("Skipped total:", skipped);
    console.log("  Skipped (calibration):", cal, "- calibration/standard readings, not real shots");
    console.log("  Skipped (junk):", junk);
    if (reasons) {
      console.log("    Junk reasons: no component:", reasons.noComponent, "| no valid lead value:", reasons.noLeadContent);
    }
    console.log("Expected if file had 5710 data rows:", expectedDataRowsIfFull);
    if (result.errors.length > 0) {
      console.log("First 10 errors:", result.errors.slice(0, 10));
    }

    expect(validReadings).toBeGreaterThan(0);
    // Every row the parser sees is either a valid reading, an error, or skipped
    expect(validReadings + errorCount + skipped).toBe(totalRowsInFile);

    // If the sheet had more rows (e.g. 5710), totalRowsInFile would be higher; we just assert no silent drops
    if (totalRowsInFile < expectedDataRowsIfFull * 0.5) {
      console.warn(
        `Note: parser only saw ${totalRowsInFile} data rows; Excel may show ${expectedDataRowsIfFull}. ` +
          "Check sheet used range or multiple sheets."
      );
    }
  }, 60000);
});
