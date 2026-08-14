"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Employee, InventoryItem } from "../lib/inventory";
import { Icon } from "./icon";

export function HandoffDialog({
  item,
  employees,
  performedBy,
  onCancel,
  onConfirm,
}: {
  item: InventoryItem;
  employees: readonly Employee[];
  performedBy: Employee;
  onCancel: () => void;
  onConfirm: (recipient: Employee) => void;
}) {
  const recipients = useMemo(
    () => employees.filter((employee) => employee.id !== item.holderId),
    [employees, item.holderId],
  );
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButton.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  const recipient = recipients.find((employee) => employee.id === recipientId);

  return (
    <div className="backdrop" onMouseDown={onCancel}>
      <div className="modal handoff-modal" role="dialog" aria-modal="true" aria-labelledby="handoff-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={onCancel} aria-label="Close hand-off dialog">×</button>
        <small>TRANSFER TOOL CUSTODY</small>
        <h2 id="handoff-title">{item.partNumber || "Unnumbered tool"}</h2>
        <p>{item.description}</p>
        <section>
          <span><small>Current holder</small><strong>{item.holder}</strong></span>
          <span><small>Hand-off performed by</small><strong>{performedBy.name}</strong></span>
        </section>
        <label>
          Hand off to
          <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)}>
            {recipients.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name} · {employee.id}</option>
            ))}
          </select>
        </label>
        <div className="timernote">
          <Icon name="out" />
          <span><strong>Direct custody transfer</strong><small>The tool stays checked out and its original workshop-out timer continues.</small></span>
        </div>
        <footer>
          <button ref={cancelButton} type="button" className="soft" onClick={onCancel}>Cancel</button>
          <button type="button" className="dark" disabled={!recipient} onClick={() => recipient && onConfirm(recipient)}>Confirm hand-off</button>
        </footer>
      </div>
    </div>
  );
}
