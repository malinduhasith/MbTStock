import { describe, expect, it } from "vitest";
import {
  DEMO_OVERDUE_MS,
  EMPLOYEES,
  InventoryItem,
  checkOutTool,
  filterInventory,
  formatElapsed,
  isOverdue,
  returnTool,
} from "../lib/inventory";

const tool: InventoryItem = {
  id: "tool-1",
  partNumber: "123 456",
  description: "Bearing puller",
  qty: 1,
  location: "TA1",
  damaged: false,
  missingParts: "",
  source: "register.xlsx",
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
    const [returned] = returnTool([checkedOut], tool.id);
    expect(returned.status).toBe("available");
    expect(returned.holder).toBeUndefined();
    expect(returned.checkedOutAt).toBeUndefined();
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
});
