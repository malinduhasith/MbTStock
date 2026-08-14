export const DEMO_OVERDUE_MS = 30_000;
export const STORAGE_VERSION = 1;

export type Tab =
  | "Workshop Desk"
  | "Dashboard"
  | "Tools"
  | "Checked Out"
  | "Usage"
  | "Employees"
  | "Info";

export type InventoryStatus = "available" | "attention" | "checked-out";
export type InventoryFilter =
  | "All tools"
  | "Available"
  | "Checked out"
  | "Needs attention";
export type WorkshopMode = "check-out" | "check-in";

export interface Employee {
  id: string;
  name: string;
  role: string;
  initials: string;
}

export interface InventoryItem {
  id: string;
  partNumber: string;
  description: string;
  qty: number;
  location: string;
  damaged: boolean;
  missingParts: string;
  source: string;
  status: InventoryStatus;
  holder?: string;
  holderId?: string;
  checkedOutAt?: number;
  usageCount: number;
}

export interface InventorySnapshot {
  version: typeof STORAGE_VERSION;
  items: InventoryItem[];
  savedAt: string;
}

export const EMPLOYEES: readonly Employee[] = [
  { id: "EMP-1042", name: "Alex Morgan", role: "Diagnostic Technician", initials: "AM" },
  { id: "EMP-1088", name: "Jamie Lee", role: "Workshop Technician", initials: "JL" },
  { id: "EMP-1124", name: "Sam Patel", role: "Team Leader", initials: "SP" },
  { id: "EMP-1161", name: "Jordan Kim", role: "Apprentice", initials: "JK" },
  { id: "EMP-1203", name: "Taylor Reed", role: "Parts Coordinator", initials: "TR" },
] as const;

type SeedItem = Omit<InventoryItem, "usageCount"> & { usageCount?: number };

const DEMO_ASSIGNMENTS = new Map<number, {
  employeeId: string;
  elapsedMs: number;
}>([
  [2, { employeeId: "EMP-1042", elapsedMs: 116_000 }],
  [18, { employeeId: "EMP-1088", elapsedMs: 74_000 }],
  [41, { employeeId: "EMP-1161", elapsedMs: 22_000 }],
]);

export function createDemoInventory(
  source: readonly SeedItem[],
  now = Date.now(),
): InventoryItem[] {
  return source.map((item, index) => {
    const usageCount =
      item.usageCount ?? 3 + ((item.description.length * 7 + index * 11) % 48);
    const assignment = DEMO_ASSIGNMENTS.get(index);

    if (!assignment) return { ...item, usageCount };

    const employee = EMPLOYEES.find(
      (candidate) => candidate.id === assignment.employeeId,
    );
    if (!employee) return { ...item, usageCount };

    return {
      ...item,
      status: "checked-out",
      holder: employee.name,
      holderId: employee.id,
      checkedOutAt: now - assignment.elapsedMs,
      usageCount,
    };
  });
}

export function requiresAttention(item: InventoryItem): boolean {
  return item.damaged || item.missingParts.trim().length > 0;
}

export function isCheckedOut(item: InventoryItem): boolean {
  return item.status === "checked-out";
}

export function canCheckOut(item: InventoryItem): boolean {
  return !isCheckedOut(item) && !requiresAttention(item);
}

export function isOverdue(
  item: InventoryItem,
  now: number,
  thresholdMs = DEMO_OVERDUE_MS,
): boolean {
  return (
    isCheckedOut(item) &&
    typeof item.checkedOutAt === "number" &&
    now - item.checkedOutAt >= thresholdMs
  );
}

export function checkOutTool(
  items: readonly InventoryItem[],
  toolId: string,
  employee: Employee,
  checkedOutAt = Date.now(),
): InventoryItem[] {
  return items.map((item) =>
    item.id === toolId && canCheckOut(item)
      ? {
          ...item,
          status: "checked-out",
          holder: employee.name,
          holderId: employee.id,
          checkedOutAt,
          usageCount: item.usageCount + 1,
        }
      : item,
  );
}

export function getWorkshopDeskItems(
  items: readonly InventoryItem[],
  mode: WorkshopMode,
  employeeId: string,
  query: string,
): InventoryItem[] {
  if (!employeeId) return [];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      [item.partNumber, item.description, item.location]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    if (!matchesQuery) return false;
    return mode === "check-in"
      ? isCheckedOut(item) && item.holderId === employeeId
      : canCheckOut(item);
  });
}

export function returnTool(
  items: readonly InventoryItem[],
  toolId: string,
): InventoryItem[] {
  return items.map((item) =>
    item.id === toolId
      ? {
          ...item,
          status: requiresAttention(item) ? "attention" : "available",
          holder: undefined,
          holderId: undefined,
          checkedOutAt: undefined,
        }
      : item,
  );
}

export function filterInventory(
  items: readonly InventoryItem[],
  query: string,
  location: string,
  filter: InventoryFilter,
): InventoryItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const searchable = [
      item.partNumber,
      item.description,
      item.location,
      item.holder ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase();
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
    const matchesLocation =
      location === "All locations" || item.location === location;
    const matchesStatus =
      filter === "All tools" ||
      (filter === "Available" && !isCheckedOut(item)) ||
      (filter === "Checked out" && isCheckedOut(item)) ||
      (filter === "Needs attention" && requiresAttention(item));
    return matchesQuery && matchesLocation && matchesStatus;
  });
}

export function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function getLocations(items: readonly InventoryItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.location))).sort();
}

export function getMostUsed(
  items: readonly InventoryItem[],
  limit = 6,
): InventoryItem[] {
  return [...items]
    .sort((left, right) => right.usageCount - left.usageCount)
    .slice(0, limit);
}

export function isInventoryItem(value: unknown): value is InventoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<InventoryItem>;
  return (
    typeof item.id === "string" &&
    typeof item.partNumber === "string" &&
    typeof item.description === "string" &&
    typeof item.qty === "number" &&
    Number.isFinite(item.qty) &&
    item.qty > 0 &&
    typeof item.location === "string" &&
    typeof item.damaged === "boolean" &&
    typeof item.missingParts === "string" &&
    typeof item.source === "string" &&
    typeof item.usageCount === "number" &&
    ["available", "attention", "checked-out"].includes(item.status ?? "")
  );
}
