import {
  EMPLOYEES,
  InventoryItem,
  WorkshopMode,
  formatElapsed,
} from "../lib/inventory";
import { Icon } from "./icon";

export function MechanicsView({
  employeeId,
  mode,
  query,
  items,
  assigned,
  now,
  onEmployeeChange,
  onModeChange,
  onQueryChange,
  onCheckOut,
  onReturn,
  onHandOff,
}: {
  employeeId: string;
  mode: WorkshopMode;
  query: string;
  items: readonly InventoryItem[];
  assigned: readonly InventoryItem[];
  now: number;
  onEmployeeChange: (employeeId: string) => void;
  onModeChange: (mode: WorkshopMode) => void;
  onQueryChange: (query: string) => void;
  onCheckOut: (item: InventoryItem) => void;
  onReturn: (item: InventoryItem) => void;
  onHandOff: (item: InventoryItem) => void;
}) {
  const employee = EMPLOYEES.find((candidate) => candidate.id === employeeId);

  if (!employee) {
    return (
      <section className="mechanics-desk identity-screen">
        <div className="desk-intro">
          <span className="step-number">1</span>
          <div><small>MECHANIC WORKSTATION</small><h2>Who are you?</h2><p>Select your profile to check tools out or return them.</p></div>
        </div>
        <div className="identity-grid">
          {EMPLOYEES.map((person) => (
            <button type="button" key={person.id} onClick={() => onEmployeeChange(person.id)}>
              <span>{person.initials}</span>
              <strong>{person.name}</strong>
              <small>{person.role}</small>
              <em>{person.id}</em>
            </button>
          ))}
        </div>
        <p className="privacy-note"><Icon name="info" /> Select only your own employee profile. Every movement is recorded against the selected ID.</p>
      </section>
    );
  }

  return (
    <section className="mechanics-desk">
      <div className="mechanic-bar">
        <div className="active-mechanic">
          <span>{employee.initials}</span>
          <div><small>WORKING AS</small><strong>{employee.name}</strong><p>{employee.id} · {employee.role}</p></div>
        </div>
        <div className="held-summary"><strong>{assigned.length}</strong><span>tools currently<br />with you</span></div>
        <button type="button" onClick={() => onEmployeeChange("")}>Change mechanic</button>
      </div>

      <div className="action-step">
        <div className="desk-intro compact">
          <span className="step-number">2</span>
          <div><small>CHOOSE AN ACTION</small><h2>What do you need to do?</h2></div>
        </div>
        <div className="mode-switch" role="group" aria-label="Tool movement action">
          <button type="button" className={mode === "check-out" ? "active" : ""} aria-pressed={mode === "check-out"} onClick={() => onModeChange("check-out")}>
            <Icon name="out" /><span><strong>Check out a tool</strong><small>Take a tool into the workshop</small></span>
          </button>
          <button type="button" className={mode === "check-in" ? "active" : ""} aria-pressed={mode === "check-in"} onClick={() => onModeChange("check-in")}>
            <Icon name="down" /><span><strong>Check in a tool</strong><small>Return any workshop tool</small></span>
          </button>
          <button type="button" className={mode === "hand-off" ? "active" : ""} aria-pressed={mode === "hand-off"} onClick={() => onModeChange("hand-off")}>
            <Icon name="users" /><span><strong>Hand off a tool</strong><small>Transfer it to another employee</small></span>
          </button>
        </div>
      </div>

      <div className="selection-step">
        <div className="desk-intro compact">
          <span className="step-number">3</span>
          <div>
            <small>{mode === "check-out" ? "SELECT A TOOL" : mode === "check-in" ? "CHECKED-OUT TOOLS" : "TRANSFER CUSTODY"}</small>
            <h2>{mode === "check-out" ? "Which tool do you need?" : mode === "check-in" ? "Which tool are you returning?" : "Which tool are you handing off?"}</h2>
          </div>
        </div>
        <label className="mechanic-search">
          <span className="sr-only">Search tools</span>
          <Icon name="search" />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search part number, tool, location or current holder…" />
          {query ? <button type="button" onClick={() => onQueryChange("")}>Clear</button> : null}
        </label>
        <div className="desk-results" aria-live="polite">
          {items.slice(0, 12).map((item) => (
            <article key={item.id}>
              <span className="desk-tool-icon"><Icon name="tools" /></span>
              <div className="desk-tool-copy">
                <small>{item.partNumber || "UNNUMBERED TOOL"}</small>
                <h3>{item.description}</h3>
                <p><b>{item.location}</b> · Qty {item.qty}{mode !== "check-out" ? ` · Held by ${item.holder}` : ""}{mode !== "check-out" && item.checkedOutAt ? ` · Out ${formatElapsed(now - item.checkedOutAt)}` : ""}</p>
              </div>
              <button type="button" className={mode === "check-out" ? "desk-checkout" : mode === "check-in" ? "desk-return" : "desk-handoff"} onClick={() => mode === "check-out" ? onCheckOut(item) : mode === "check-in" ? onReturn(item) : onHandOff(item)}>
                {mode === "check-out" ? "Select & check out" : mode === "check-in" ? "Check in now" : "Choose recipient"}
              </button>
            </article>
          ))}
          {!items.length ? (
            <div className="desk-empty">
              <Icon name={mode === "check-out" ? "search" : mode === "check-in" ? "down" : "users"} />
              <strong>{mode === "check-out" ? "No available tools found" : mode === "check-in" ? "No checked-out tools match" : "No checked-out tools available to hand off"}</strong>
              <p>{mode === "check-out" ? "Try a part number, tool name, or storage location." : "Try another tool name, part number, or holder."}</p>
            </div>
          ) : null}
        </div>
        {items.length > 12 ? <p className="desk-more">Showing the first 12 results. Refine your search to narrow the list.</p> : null}
      </div>
    </section>
  );
}
