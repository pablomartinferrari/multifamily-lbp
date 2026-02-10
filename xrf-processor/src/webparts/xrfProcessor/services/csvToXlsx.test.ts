import { convertCsvToXlsx, isCsvFileName } from "./csvToXlsx";
import * as XLSX from "xlsx";

function csvBuffer(csv: string): ArrayBuffer {
  return new TextEncoder().encode(csv).buffer;
}

describe("csvToXlsx", () => {
  describe("isCsvFileName", () => {
    it("returns true for .csv extension", () => {
      expect(isCsvFileName("data.csv")).toBe(true);
      expect(isCsvFileName("file.CSV")).toBe(true);
    });
    it("returns false for non-csv", () => {
      expect(isCsvFileName("data.xlsx")).toBe(false);
      expect(isCsvFileName("file.txt")).toBe(false);
    });
  });

  describe("convertCsvToXlsx", () => {
    it("converts simple CSV to XLSX buffer", () => {
      const csv = "A,B,C\n1,2,3\n4,5,6";
      const xlsx = convertCsvToXlsx(csvBuffer(csv));
      expect(xlsx).toBeInstanceOf(ArrayBuffer);
      expect(xlsx.byteLength).toBeGreaterThan(0);

      const wb = XLSX.read(xlsx, { type: "array" });
      expect(wb.SheetNames.length).toBeGreaterThan(0);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      expect(data[0]).toEqual(["A", "B", "C"]);
      expect(data[1]).toHaveLength(3);
      expect(data[2]).toHaveLength(3);
      expect(String(data[1][0])).toBe("1");
      expect(String(data[2][0])).toBe("4");
    });

    it("converts XRF-style CSV headers to XLSX", () => {
      const csv = `Reading ID,Component,Color,Lead Content
R1,Wall,Paint,0.5
R2,Trim,White,Negative`;
      const xlsx = convertCsvToXlsx(csvBuffer(csv));
      const wb = XLSX.read(xlsx, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
      expect(data[0]).toEqual(["Reading ID", "Component", "Color", "Lead Content"]);
      expect(data[1]).toEqual(["R1", "Wall", "Paint", "0.5"]);
      expect(data[2]).toEqual(["R2", "Trim", "White", "Negative"]);
    });
  });
});
