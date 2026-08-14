import { describe, expect, it } from "vitest";
import { inventoryFromRows } from "../lib/excel";

describe("Excel register adapter", () => {
  it("maps the supplied register layout without losing identifiers", () => {
    const rows: unknown[][] = [[], [], [], [], []];
    rows[4][0] = "271 589 07 63 00";
    rows[4][3] = "Workshop press-in tool";
    rows[4][9] = 2;
    rows[4][12] = "TA1";
    rows[4][14] = "N";
    const [item] = inventoryFromRows(rows, "TA register.xlsx");
    expect(item).toMatchObject({
      partNumber: "271 589 07 63 00",
      description: "Workshop press-in tool",
      qty: 2,
      location: "TA1",
      status: "available",
    });
  });

  it("flags damage and missing parts for attention", () => {
    const rows: unknown[][] = [[], [], [], [], []];
    rows[4][3] = "Damaged fixture";
    rows[4][12] = "TB1";
    rows[4][14] = "Y";
    rows[4][16] = "Locking pin";
    const [item] = inventoryFromRows(rows, "TB register.xlsx");
    expect(item.status).toBe("attention");
    expect(item.missingParts).toBe("Locking pin");
  });
});
