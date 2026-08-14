import {
  CustodyAction,
  Employee,
  InventoryItem,
  MovementEvent,
  canCheckOut,
  checkOutTool,
  handOffTool,
  isCheckedOut,
  returnTool,
} from "./inventory";

export class CustodyError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_ACTION"
      | "TOOL_NOT_FOUND"
      | "EMPLOYEE_NOT_FOUND"
      | "TOOL_UNAVAILABLE"
      | "VERSION_CONFLICT",
    readonly status: number,
  ) {
    super(message);
    this.name = "CustodyError";
  }
}

export interface CustodyResult {
  item: InventoryItem;
  event: MovementEvent;
}

function activeEmployee(
  employees: readonly Employee[],
  employeeId: string,
): Employee {
  const employee = employees.find(
    (candidate) => candidate.id === employeeId && candidate.active,
  );
  if (!employee) {
    throw new CustodyError(
      "The selected employee is not active or does not exist.",
      "EMPLOYEE_NOT_FOUND",
      404,
    );
  }
  return employee;
}

export function applyCustodyAction(
  items: readonly InventoryItem[],
  employees: readonly Employee[],
  action: CustodyAction,
  occurredAt: number,
  eventId: string,
): CustodyResult {
  const current = items.find((item) => item.id === action.toolId);
  if (!current) {
    throw new CustodyError(
      "The selected tool no longer exists.",
      "TOOL_NOT_FOUND",
      404,
    );
  }

  const currentVersion = current.rowVersion ?? 1;
  if (
    typeof action.expectedVersion === "number" &&
    action.expectedVersion !== currentVersion
  ) {
    throw new CustodyError(
      "This tool changed after the page was loaded. Refresh and try again.",
      "VERSION_CONFLICT",
      409,
    );
  }

  let updated: InventoryItem;
  let event: MovementEvent;

  if (action.type === "check-out") {
    const employee = activeEmployee(employees, action.employeeId);
    if (!canCheckOut(current)) {
      throw new CustodyError(
        "This tool is already checked out or requires attention.",
        "TOOL_UNAVAILABLE",
        409,
      );
    }
    [updated] = checkOutTool([current], current.id, employee, occurredAt);
    event = {
      id: eventId,
      toolId: current.id,
      type: "checked-out",
      toEmployeeId: employee.id,
      performedByEmployeeId: employee.id,
      occurredAt,
      originalCheckedOutAt: occurredAt,
      notes: "",
    };
  } else if (action.type === "return") {
    const performedBy = activeEmployee(
      employees,
      action.performedByEmployeeId,
    );
    if (!isCheckedOut(current)) {
      throw new CustodyError(
        "This tool is not currently checked out.",
        "TOOL_UNAVAILABLE",
        409,
      );
    }
    [updated] = returnTool([current], current.id, performedBy, occurredAt);
    event = {
      id: eventId,
      toolId: current.id,
      type: "returned",
      fromEmployeeId: current.holderId,
      performedByEmployeeId: performedBy.id,
      occurredAt,
      originalCheckedOutAt: current.checkedOutAt,
      notes: "",
    };
  } else {
    const performedBy = activeEmployee(
      employees,
      action.performedByEmployeeId,
    );
    const recipient = activeEmployee(employees, action.recipientEmployeeId);
    if (!isCheckedOut(current) || current.holderId === recipient.id) {
      throw new CustodyError(
        "This tool cannot be handed to the selected employee.",
        "TOOL_UNAVAILABLE",
        409,
      );
    }
    [updated] = handOffTool(
      [current],
      current.id,
      recipient,
      performedBy,
      occurredAt,
    );
    event = {
      id: eventId,
      toolId: current.id,
      type: "handed-off",
      fromEmployeeId: current.holderId,
      toEmployeeId: recipient.id,
      performedByEmployeeId: performedBy.id,
      occurredAt,
      originalCheckedOutAt: current.checkedOutAt,
      notes: "",
    };
  }

  return {
    item: { ...updated, rowVersion: currentVersion + 1 },
    event,
  };
}

export function isCustodyAction(value: unknown): value is CustodyAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  if (typeof action.type !== "string" || typeof action.toolId !== "string") {
    return false;
  }
  const expectedVersion = action.expectedVersion;
  if (
    expectedVersion !== undefined &&
    (typeof expectedVersion !== "number" ||
      !Number.isInteger(expectedVersion) ||
      expectedVersion < 1)
  ) {
    return false;
  }
  if (action.type === "check-out") {
    return typeof action.employeeId === "string";
  }
  if (action.type === "return") {
    return typeof action.performedByEmployeeId === "string";
  }
  if (action.type === "hand-off") {
    return (
      typeof action.performedByEmployeeId === "string" &&
      typeof action.recipientEmployeeId === "string"
    );
  }
  return false;
}
