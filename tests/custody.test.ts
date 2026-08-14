import { describe, expect, it } from "vitest";
import { applyCustodyAction, CustodyError } from "../lib/custody";
import { EMPLOYEES, InventoryItem } from "../lib/inventory";

const tool: InventoryItem = {
  id: "DEMO-001",
  partNumber: "SIM-TOOL-001",
  description: "Diagnostic scan tablet",
  qty: 1,
  location: "Demo Diagnostics",
  damaged: false,
  missingParts: "",
  source: "Fictional demo register.xlsx",
  status: "available",
  usageCount: 2,
  rowVersion: 4,
};

describe("audited custody actions", () => {
  it("creates a checkout event and advances the row version", () => {
    const result = applyCustodyAction(
      [tool],
      EMPLOYEES,
      {
        type: "check-out",
        toolId: tool.id,
        employeeId: EMPLOYEES[0].id,
        expectedVersion: 4,
      },
      10_000,
      "event-1",
    );
    expect(result.item).toMatchObject({
      status: "checked-out",
      holderId: EMPLOYEES[0].id,
      rowVersion: 5,
    });
    expect(result.event).toMatchObject({
      id: "event-1",
      type: "checked-out",
      toEmployeeId: EMPLOYEES[0].id,
      performedByEmployeeId: EMPLOYEES[0].id,
      originalCheckedOutAt: 10_000,
    });
  });

  it("records a return performed by someone other than the holder", () => {
    const checkedOut = {
      ...tool,
      status: "checked-out" as const,
      holder: EMPLOYEES[0].name,
      holderId: EMPLOYEES[0].id,
      checkedOutAt: 10_000,
    };
    const result = applyCustodyAction(
      [checkedOut],
      EMPLOYEES,
      {
        type: "return",
        toolId: tool.id,
        performedByEmployeeId: EMPLOYEES[1].id,
        expectedVersion: 4,
      },
      20_000,
      "event-2",
    );
    expect(result.item.status).toBe("available");
    expect(result.event).toMatchObject({
      type: "returned",
      fromEmployeeId: EMPLOYEES[0].id,
      performedByEmployeeId: EMPLOYEES[1].id,
      originalCheckedOutAt: 10_000,
    });
  });

  it("preserves the original checkout time across a hand-off", () => {
    const checkedOut = {
      ...tool,
      status: "checked-out" as const,
      holder: EMPLOYEES[0].name,
      holderId: EMPLOYEES[0].id,
      checkedOutAt: 10_000,
    };
    const result = applyCustodyAction(
      [checkedOut],
      EMPLOYEES,
      {
        type: "hand-off",
        toolId: tool.id,
        performedByEmployeeId: EMPLOYEES[0].id,
        recipientEmployeeId: EMPLOYEES[2].id,
        expectedVersion: 4,
      },
      20_000,
      "event-3",
    );
    expect(result.item).toMatchObject({
      holderId: EMPLOYEES[2].id,
      checkedOutAt: 10_000,
    });
    expect(result.event.originalCheckedOutAt).toBe(10_000);
  });

  it("rejects a stale client version", () => {
    expect(() =>
      applyCustodyAction(
        [tool],
        EMPLOYEES,
        {
          type: "check-out",
          toolId: tool.id,
          employeeId: EMPLOYEES[0].id,
          expectedVersion: 3,
        },
        10_000,
        "event-4",
      ),
    ).toThrowError(CustodyError);
  });
});
