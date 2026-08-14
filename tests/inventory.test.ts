import { describe, expect, it } from "vitest";
import {
  DEMO_OVERDUE_MS,
  EMPLOYEES,
  InventoryItem,
  checkOutTool,
  filterInventory,
  formatElapsed,
  getWorkshopDeskItems,
  handOffTool,
  isOverdue,
  returnTool,
} from "../lib/inventory";

const tool: InventoryItem = {
  id: "tool-1",
  partNumber: "SIM-TOOL-001",
  description: "Bearing puller",
  qty: 1,
  location: "Demo Bay A",
  damaged: false,
  missingParts: "",
  source: "Fictional demo register.xlsx",
  status: "available",
  usageCount: 2,
};

describe("inventory workflow", () => {
  it("checks out a tool and increments usage", () => {
    const [result] = checkOutTool([tool], tool.id, EMPLOYEES[0], 1_000);
    expect(result).toMatchObject({
      status: "checked-out",
      holderId: EMPLOYEES[0].id,
      checkedOutAt: 1_000,
      usageCount: 3,
    });
  });

  it("only becomes overdue at the configured threshold", () => {
    const [checkedOut] = checkOutTool([tool], tool.id, EMPLOYEES[0], 1_000);
    expect(isOverdue(checkedOut, 1_000 + DEMO_OVERDUE_MS - 1)).toBe(false);
    expect(isOverdue(checkedOut, 1_000 + DEMO_OVERDUE_MS)).toBe(true);
  });

  it("returns a serviceable tool and removes assignment data", () => {
    const [checkedOut] = checkOutTool([tool], tool.id, EMPLOYEES[0], 1_000);
    const [returned] = returnTool(
      [checkedOut],
      tool.id,
      EMPLOYEES[1],
      2_000,
    );
    expect(returned.status).toBe("available");
    expect(returned.holder).toBeUndefined();
    expect(returned.checkedOutAt).toBeUndefined();
    expect(returned.lastMovementById).toBe(EMPLOYEES[1].id);
    expect(returned.lastMovementType).toBe("returned");
  });

  it("searches part number, description, location, and holder", () => {
    const [checkedOut] = checkOutTool([tool], tool.id, EMPLOYEES[0], 1_000);
    expect(filterInventory([checkedOut], "alex", "All locations", "All tools")).toHaveLength(1);
    expect(filterInventory([checkedOut], "missing", "All locations", "All tools")).toHaveLength(0);
  });

  it("formats elapsed time for workshop display", () => {
    expect(formatElapsed(29_000)).toBe("29s");
    expect(formatElapsed(90_000)).toBe("1m 30s");
    expect(formatElapsed(3_660_000)).toBe("1h 1m");
  });

  it("allows any employee to see and return checked-out tools", () => {
    const [checkedOut] = checkOutTool([tool], tool.id, EMPLOYEES[0], 1_000);
    expect(
      getWorkshopDeskItems(
        [checkedOut],
        "check-in",
        EMPLOYEES[0].id,
        "",
      ),
    ).toHaveLength(1);
    expect(
      getWorkshopDeskItems(
        [checkedOut],
        "check-in",
        EMPLOYEES[1].id,
        "",
      ),
    ).toHaveLength(1);
  });

  it("hands custody directly to another employee without resetting out time", () => {
    const [checkedOut] = checkOutTool(
      [tool],
      tool.id,
      EMPLOYEES[0],
      1_000,
    );
    const [transferred] = handOffTool(
      [checkedOut],
      tool.id,
      EMPLOYEES[2],
      EMPLOYEES[1],
      2_000,
    );
    expect(transferred).toMatchObject({
      status: "checked-out",
      holderId: EMPLOYEES[2].id,
      checkedOutAt: 1_000,
      lastMovementType: "handed-off",
      lastMovementById: EMPLOYEES[1].id,
      lastMovementAt: 2_000,
    });
  });

  it("does not offer damaged tools for mechanic check-out", () => {
    const damaged = { ...tool, id: "damaged", damaged: true };
    expect(
      getWorkshopDeskItems(
        [tool, damaged],
        "check-out",
        EMPLOYEES[0].id,
        "",
      ),
    ).toEqual([tool]);
    expect(checkOutTool([damaged], damaged.id, EMPLOYEES[0])).toEqual([
      damaged,
    ]);
  });
});
