import * as XLSX from "xlsx";

/**
 * Convert CSV file content to XLSX format in memory.
 * Use this before parsing when CSV ingestion is unreliable; the rest of the
 * pipeline always works with XLSX.
 *
 * @param csvBuffer - Raw bytes of the CSV file (UTF-8)
 * @returns ArrayBuffer of an XLSX workbook
 */
export function convertCsvToXlsx(csvBuffer: ArrayBuffer): ArrayBuffer {
  const dec = new TextDecoder("utf-8", { fatal: false });
  const csvString = dec.decode(csvBuffer);

  const workbook = XLSX.read(csvString, {
    type: "string",
    raw: true,
    cellDates: true,
  });

  const u8 = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const out = new Uint8Array(u8);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

export function isCsvFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".csv");
}
