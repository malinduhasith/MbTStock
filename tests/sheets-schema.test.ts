import { describe, expect, it } from "vitest";
import { EMPLOYEES, InventoryItem, MovementEvent } from "../lib/inventory";
import {
  employeeFromSheetRow,
  movementFromSheetRow,
  movementToSheetRow,
  toolFromSheetRow,
  toolToSheetRow,
} from "../lib/sheets-schema";

describe("Google Sheets schema adapter", () => {
  it("round-trips an inventory row without losing custody state", () => {
    const item: InventoryItem = {
      id: "DEMO-001",
      partNumber: "SIM-TOOL-001",
      description: "Diagnostic scan tablet",
      qty: 2,
      location: "Demo Diagnostics",
      damaged: false,
      missingParts: "",
      source: "Fictional demonstration data",
      status: "checked-out",
      holder: EMPLOYEES[0].name,
      holderId: EMPLOYEES[0].id,
      checkedOutAt: Date.parse("2026-08-15T01:00:00.000Z"),
      usageCount: 8,
      lastMovementType: "checked-out",
      lastMovementBy: EMPLOYEES[0].name,
      lastMovementById: EMPLOYEES[0].id,
      lastMovementAt: Date.parse("2026-08-15T01:00:00.000Z"),
      rowVersion: 7,
    };
    const parsed = toolFromSheetRow(toolToSheetRow(item), 9, EMPLOYEES);
    expect(parsed).toMatchObject({
      rowNumber: 9,
      item: {
        id: item.id,
        holderId: EMPLOYEES[0].id,
        checkedOutAt: item.checkedOutAt,
        rowVersion: 7,
      },
    });
  });

  it("round-trips append-only movement events", () => {
    const event: MovementEvent = {
      id: "event-1",
      toolId: "DEMO-001",
      type: "handed-off",
      fromEmployeeId: EMPLOYEES[0].id,
      toEmployeeId: EMPLOYEES[1].id,
      performedByEmployeeId: EMPLOYEES[2].id,
      occurredAt: Date.parse("2026-08-15T01:05:00.000Z"),
      originalCheckedOutAt: Date.parse("2026-08-15T01:00:00.000Z"),
      notes: "",
    };
    expect(movementFromSheetRow(movementToSheetRow(event))).toEqual(event);
  });

  it("treats a blank active flag as active for simple employee lists", () => {
    expect(
      employeeFromSheetRow([
        "EMP-2001",
        "Morgan Avery",
        "Technician",
        "",
        "MA",
      ]),
    ).toMatchObject({ id: "EMP-2001", active: true });
  });
});
