import { describe, expect, it } from "vitest";
import { inventoryFromRows } from "../lib/excel";

describe("Excel register adapter", () => {
  it("maps the supported register layout without losing identifiers", () => {
    const rows: unknown[][] = [[], [], [], [], []];
    rows[4][0] = "SIM-TOOL-271";
    rows[4][3] = "Workshop press-in tool";
    rows[4][9] = 2;
    rows[4][12] = "Demo Bay A";
    rows[4][14] = "N";
    const [item] = inventoryFromRows(rows, "Fictional demo register.xlsx");
    expect(item).toMatchObject({
      partNumber: "SIM-TOOL-271",
      description: "Workshop press-in tool",
      qty: 2,
      location: "Demo Bay A",
      status: "available",
    });
  });

  it("flags damage and missing parts for attention", () => {
    const rows: unknown[][] = [[], [], [], [], []];
    rows[4][3] = "Damaged fixture";
    rows[4][12] = "Demo Bay B";
    rows[4][14] = "Y";
    rows[4][16] = "Locking pin";
    const [item] = inventoryFromRows(rows, "Fictional demo register.xlsx");
    expect(item.status).toBe("attention");
    expect(item.missingParts).toBe("Locking pin");
  });
});
