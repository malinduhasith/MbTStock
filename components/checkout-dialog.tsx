"use client";

import { useEffect, useRef } from "react";
import { EMPLOYEES, InventoryItem } from "../lib/inventory";
import { Icon } from "./icon";

export function CheckoutDialog({
  item,
  employeeId,
  onEmployeeChange,
  onCancel,
  onConfirm,
}: {
  item: InventoryItem;
  employeeId: string;
  onEmployeeChange: (employeeId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelButton.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  return (
    <div className="backdrop" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={onCancel} aria-label="Close check-out dialog">×</button>
        <small>WORKSHOP CHECK-OUT</small>
        <h2 id="checkout-title">{item.partNumber || "Unnumbered tool"}</h2>
        <p>{item.description}</p>
        <section>
          <span><small>Storage area</small><strong>{item.location}</strong></span>
          <span><small>Condition</small><strong>{item.damaged || item.missingParts ? "Attention" : "Serviceable"}</strong></span>
        </section>
        <label>
          Assign to employee
          <select value={employeeId} onChange={(event) => onEmployeeChange(event.target.value)}>
            {EMPLOYEES.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name} · {employee.id}</option>
            ))}
          </select>
        </label>
        <div className="timernote">
          <Icon name="clock" />
          <span><strong>30-second demo alert</strong><small>This tool appears in follow-up after 30 seconds.</small></span>
        </div>
        <footer>
          <button ref={cancelButton} type="button" className="soft" onClick={onCancel}>Cancel</button>
          <button type="button" className="dark" onClick={onConfirm}>Confirm check-out</button>
        </footer>
      </div>
    </div>
  );
}
