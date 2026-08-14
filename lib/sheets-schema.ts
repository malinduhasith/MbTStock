import {
  Employee,
  InventoryItem,
  InventoryStatus,
  MovementEvent,
  MovementType,
  requiresAttention,
} from "./inventory";

export const SHEET_NAMES = {
  tools: "Tools",
  employees: "Employees",
  movements: "Tool_Movements",
} as const;

export const TOOL_HEADERS = [
  "tool_id",
  "part_number",
  "description",
  "quantity",
  "location",
  "damaged",
  "missing_parts",
  "source",
  "status",
  "current_holder_id",
  "checked_out_at",
  "usage_count",
  "last_movement_type",
  "last_movement_by_employee_id",
  "last_movement_at",
  "row_version",
] as const;

export const EMPLOYEE_HEADERS = [
  "employee_id",
  "name",
  "role",
  "active",
  "initials",
] as const;

export const MOVEMENT_HEADERS = [
  "event_id",
  "tool_id",
  "event_type",
  "from_employee_id",
  "to_employee_id",
  "performed_by_employee_id",
  "event_at",
  "checked_out_at_original",
  "notes",
] as const;

export interface SheetToolRow {
  rowNumber: number;
  item: InventoryItem;
}

type SheetValue = string | number | boolean;

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return fallback;
}

function timestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) return value;
    if (value > 1) return Math.round((value - 25_569) * 86_400_000);
  }
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function movementType(value: unknown): MovementType | undefined {
  const normalized = text(value).toUpperCase().replaceAll("-", "_");
  if (normalized === "CHECK_OUT" || normalized === "CHECKED_OUT") {
    return "checked-out";
  }
  if (normalized === "RETURN" || normalized === "RETURNED") {
    return "returned";
  }
  if (normalized === "HAND_OFF" || normalized === "HANDED_OFF") {
    return "handed-off";
  }
  return undefined;
}

function movementLabel(type: MovementType | undefined): string {
  if (type === "checked-out") return "CHECK_OUT";
  if (type === "returned") return "RETURN";
  if (type === "handed-off") return "HAND_OFF";
  return "";
}

function iso(value: number | undefined): string {
  return typeof value === "number" ? new Date(value).toISOString() : "";
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function employeeFromSheetRow(row: readonly unknown[]): Employee | null {
  const id = text(row[0]);
  const name = text(row[1]);
  if (!id || !name) return null;
  return {
    id,
    name,
    role: text(row[2]) || "Workshop employee",
    active: booleanValue(row[3], true),
    initials: text(row[4]) || initialsFor(name),
  };
}

export function employeeToSheetRow(employee: Employee): SheetValue[] {
  return [
    employee.id,
    employee.name,
    employee.role,
    employee.active,
    employee.initials,
  ];
}

export function toolFromSheetRow(
  row: readonly unknown[],
  rowNumber: number,
  employees: readonly Employee[],
): SheetToolRow | null {
  const id = text(row[0]);
  const description = text(row[2]);
  const location = text(row[4]);
  if (!id || !description || !location) return null;

  const holderId = text(row[9]) || undefined;
  const holder = holderId
    ? employees.find((employee) => employee.id === holderId)?.name ??
      `Unknown employee (${holderId})`
    : undefined;
  const damaged = booleanValue(row[5]);
  const missingParts = text(row[6]);
  const storedStatus = text(row[8]) as InventoryStatus;
  const status: InventoryStatus = [
    "available",
    "attention",
    "checked-out",
  ].includes(storedStatus)
    ? storedStatus
    : holderId
      ? "checked-out"
      : damaged || missingParts
        ? "attention"
        : "available";
  const lastMovementType = movementType(row[12]);
  const lastMovementById = text(row[13]) || undefined;

  const item: InventoryItem = {
    id,
    partNumber: text(row[1]),
    description,
    qty: positiveNumber(row[3], 1),
    location,
    damaged,
    missingParts,
    source: text(row[7]) || "Google Sheets",
    status,
    holder,
    holderId,
    checkedOutAt: timestamp(row[10]),
    usageCount: Math.max(0, Math.floor(Number(row[11]) || 0)),
    lastMovementType,
    lastMovementBy: lastMovementById
      ? employees.find((employee) => employee.id === lastMovementById)?.name ??
        `Unknown employee (${lastMovementById})`
      : undefined,
    lastMovementById,
    lastMovementAt: timestamp(row[14]),
    rowVersion: Math.max(1, Math.floor(Number(row[15]) || 1)),
  };

  if (!holderId && requiresAttention(item)) item.status = "attention";
  return { rowNumber, item };
}

export function toolToSheetRow(item: InventoryItem): SheetValue[] {
  return [
    item.id,
    item.partNumber,
    item.description,
    item.qty,
    item.location,
    item.damaged,
    item.missingParts,
    item.source,
    item.status,
    item.holderId ?? "",
    iso(item.checkedOutAt),
    item.usageCount,
    movementLabel(item.lastMovementType),
    item.lastMovementById ?? "",
    iso(item.lastMovementAt),
    item.rowVersion ?? 1,
  ];
}

export function movementFromSheetRow(
  row: readonly unknown[],
): MovementEvent | null {
  const id = text(row[0]);
  const toolId = text(row[1]);
  const type = movementType(row[2]);
  const performedByEmployeeId = text(row[5]);
  const occurredAt = timestamp(row[6]);
  if (!id || !toolId || !type || !performedByEmployeeId || !occurredAt) {
    return null;
  }
  return {
    id,
    toolId,
    type,
    fromEmployeeId: text(row[3]) || undefined,
    toEmployeeId: text(row[4]) || undefined,
    performedByEmployeeId,
    occurredAt,
    originalCheckedOutAt: timestamp(row[7]),
    notes: text(row[8]),
  };
}

export function movementToSheetRow(event: MovementEvent): SheetValue[] {
  return [
    event.id,
    event.toolId,
    movementLabel(event.type),
    event.fromEmployeeId ?? "",
    event.toEmployeeId ?? "",
    event.performedByEmployeeId,
    iso(event.occurredAt),
    iso(event.originalCheckedOutAt),
    event.notes,
  ];
}

export function headersMatch(
  actual: readonly unknown[],
  expected: readonly string[],
): boolean {
  return expected.every((header, index) => text(actual[index]) === header);
}

export function toCellData(values: readonly SheetValue[]) {
  return {
    values: values.map((value) => ({
      userEnteredValue:
        typeof value === "number"
          ? { numberValue: value }
          : typeof value === "boolean"
            ? { boolValue: value }
            : { stringValue: value },
    })),
  };
}
