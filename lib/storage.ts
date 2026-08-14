import {
  InventoryItem,
  InventorySnapshot,
  STORAGE_VERSION,
  isInventoryItem,
} from "./inventory";

const STORAGE_KEY = "mbt-stock:inventory:v2";
const LEGACY_STORAGE_KEYS = ["mbt-stock:inventory:v1"] as const;

export function loadInventory(): InventoryItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<InventorySnapshot>;
    if (
      snapshot.version !== STORAGE_VERSION ||
      !Array.isArray(snapshot.items) ||
      !snapshot.items.every(isInventoryItem)
    ) {
      return null;
    }
    return snapshot.items;
  } catch {
    return null;
  }
}

export function saveInventory(items: readonly InventoryItem[]): void {
  if (typeof window === "undefined") return;
  const snapshot: InventorySnapshot = {
    version: STORAGE_VERSION,
    items: [...items],
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearInventory(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}
