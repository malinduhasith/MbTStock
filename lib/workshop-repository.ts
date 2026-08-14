import {
  CustodyAction,
  EMPLOYEES,
  InventoryItem,
  MovementEvent,
  WorkshopDataset,
  createDemoInventory,
} from "./inventory";
import {
  loadGoogleSheetsDataset,
  mutateGoogleSheetsDataset,
} from "./google-sheets";

function demoMovements(items: readonly InventoryItem[]): MovementEvent[] {
  return items.flatMap((item) =>
    item.lastMovementType && item.lastMovementById && item.lastMovementAt
      ? [
          {
            id: `DEMO-EVENT-${item.id}`,
            toolId: item.id,
            type: item.lastMovementType,
            toEmployeeId: item.holderId,
            performedByEmployeeId: item.lastMovementById,
            occurredAt: item.lastMovementAt,
            originalCheckedOutAt: item.checkedOutAt,
            notes: "Fictional demonstration movement",
          } satisfies MovementEvent,
        ]
      : [],
  );
}

export function createDemoDataset(
  seed: readonly InventoryItem[],
): WorkshopDataset {
  const items = createDemoInventory(seed);
  return {
    source: "demo",
    writable: false,
    items,
    employees: [...EMPLOYEES],
    movements: demoMovements(items),
    loadedAt: new Date().toISOString(),
  };
}

export async function loadWorkshopDataset(
  seed: readonly InventoryItem[],
): Promise<WorkshopDataset> {
  return (await loadGoogleSheetsDataset(seed)) ?? createDemoDataset(seed);
}

export async function recordCustodyAction(
  seed: readonly InventoryItem[],
  action: CustodyAction,
): Promise<WorkshopDataset> {
  return mutateGoogleSheetsDataset(seed, action);
}
