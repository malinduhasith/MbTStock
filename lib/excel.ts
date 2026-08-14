import { InventoryItem, requiresAttention } from "./inventory";

type WorkbookRow = readonly unknown[];

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function quantity(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function inventoryFromRows(
  rows: readonly WorkbookRow[],
  sourceName: string,
): InventoryItem[] {
  const items: InventoryItem[] = [];
  rows.slice(4).forEach((row, index) => {
    const description = text(row[3]);
    const location = text(row[12]);
    if (!description || !location) return;
    const damaged = text(row[14]).toUpperCase() === "Y";
    const missingParts = text(row[16]);
    const item: InventoryItem = {
      id: `${sourceName}:${location}:${index}`,
      partNumber: text(row[0]),
      description,
      qty: quantity(row[9]),
      location,
      damaged,
      missingParts,
      source: sourceName,
      status: "available",
      usageCount: 0,
    };
    item.status = requiresAttention(item) ? "attention" : "available";
    items.push(item);
  });
  return items;
}

export async function readInventoryWorkbook(file: File): Promise<InventoryItem[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer());
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("The workbook contains no sheets.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets[firstSheetName],
    { header: 1, defval: "" },
  );
  const items = inventoryFromRows(rows, file.name);
  if (!items.length) {
    throw new Error("No inventory records were found in the expected register layout.");
  }
  return items;
}

export async function downloadInventoryWorkbook(
  items: readonly InventoryItem[],
): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = items.map((item) => ({
    "PART NUMBER": item.partNumber,
    "PART DESCRIPTION": item.description,
    QTY: item.qty,
    LOCATION: item.location,
    "DAMAGE (Y/N)": item.damaged ? "Y" : "N",
    "MISSING PARTS": item.missingParts,
    STATUS: item.status,
    "ASSIGNED TO": item.holder ?? "",
    "EMPLOYEE ID": item.holderId ?? "",
    "CHECKED OUT": item.checkedOutAt
      ? new Date(item.checkedOutAt).toISOString()
      : "",
    "USAGE COUNT": item.usageCount,
    "LAST MOVEMENT": item.lastMovementType ?? "",
    "MOVEMENT PERFORMED BY": item.lastMovementBy ?? "",
    "MOVEMENT EMPLOYEE ID": item.lastMovementById ?? "",
    "LAST MOVEMENT AT": item.lastMovementAt
      ? new Date(item.lastMovementAt).toISOString()
      : "",
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    "TOOL REGISTER",
  );
  XLSX.writeFile(workbook, "MbT-Stock-Tool-Register.xlsx");
}
