import {
  EMPLOYEES,
  InventoryItem,
  Tab,
  formatElapsed,
  isOverdue,
} from "../lib/inventory";
import { Icon } from "./icon";
import { CardHeading, EmptyState } from "./shared";

export function CheckedOutView({
  items,
  overdueCount,
  now,
  onReturn,
}: {
  items: readonly InventoryItem[];
  overdueCount: number;
  now: number;
  onReturn: (item: InventoryItem) => void;
}) {
  return (
    <section className="stack">
      <div className="summary">
        <Icon name="clock" />
        <div><small>LIVE DEMO RULE</small><h2>A tool is flagged after 30 seconds out.</h2><p>The production threshold can be hours, a shift, or a due date.</p></div>
        <strong>{overdueCount}<small>need follow-up</small></strong>
      </div>
      <article className="card">
        <CardHeading caption="CURRENT MOVEMENT" title="Checked-out tools" />
        <div className="outgrid">
          {items.map((item) => {
            const overdue = isOverdue(item, now);
            const employee = EMPLOYEES.find((candidate) => candidate.id === item.holderId);
            return (
              <article key={item.id} className={overdue ? "overdue" : ""}>
                <div><i><Icon name="tools" /></i><em>{overdue ? "Follow up" : "In use"}</em></div>
                <h3>{item.description}</h3>
                <p>{item.partNumber || "Unnumbered tool"} · {item.location}</p>
                <section>
                  <b>{employee?.initials ?? "–"}</b>
                  <span><small>Assigned to</small><strong>{item.holder}</strong></span>
                  <em>{formatElapsed(now - (item.checkedOutAt ?? now))}</em>
                </section>
                <button type="button" onClick={() => onReturn(item)}>Return to workshop</button>
              </article>
            );
          })}
        </div>
        {!items.length ? <EmptyState title="No tools are checked out" description="Use the Tools view to create an assignment." /> : null}
      </article>
    </section>
  );
}

export function UsageView({ items }: { items: readonly InventoryItem[] }) {
  const maxUsage = items[0]?.usageCount || 1;
  return (
    <section className="stack">
      <article className="card report">
        <CardHeading caption="UTILISATION REPORT" title="Most-used workshop tools" />
        <p>Demand insight helps plan duplicates, servicing, and storage placement.</p>
        {items.map((item, index) => (
          <div className="bigbar" key={item.id}>
            <b>{index + 1}</b>
            <span><strong>{item.description}</strong><small>{item.partNumber || "No part number"} · {item.location}</small><i><em style={{ width: `${(item.usageCount / maxUsage) * 100}%` }} /></i></span>
            <strong>{item.usageCount}<small>uses</small></strong>
          </div>
        ))}
      </article>
    </section>
  );
}

export function EmployeesView({
  checkedOut,
  now,
  navigate,
}: {
  checkedOut: readonly InventoryItem[];
  now: number;
  navigate: (tab: Tab) => void;
}) {
  return (
    <section className="employees">
      {EMPLOYEES.map((employee) => {
        const assigned = checkedOut.filter((item) => item.holderId === employee.id);
        const overdue = assigned.filter((item) => isOverdue(item, now));
        return (
          <article key={employee.id}>
            <header><b>{employee.initials}</b><span><h3>{employee.name}</h3><p>{employee.role}</p><small>{employee.id}</small></span></header>
            <div><span><strong>{assigned.length}</strong><small>tools held</small></span><span><strong>{overdue.length}</strong><small>over threshold</small></span></div>
            <button type="button" onClick={() => navigate("Checked Out")}>{assigned.length ? "View assignments" : "No current assignments"}</button>
          </article>
        );
      })}
    </section>
  );
}

const information = [
  ["01", "Dashboard", "Inventory totals, employee assignments, most-used tools, condition flags and overdue movement in one view."],
  ["02", "Check-out control", "Select a tool and employee. The demo starts a live timer and raises an alert after 30 seconds."],
  ["03", "Excel workflow", "Start with fictional demo data, optionally import an approved workbook, then export a revised file with assignment and usage data."],
  ["04", "Production direction", "Move to an online database for simultaneous users, reliable history, permissions and backups."],
] as const;

export function InfoView() {
  return (
    <section className="infopage">
      <div className="infohero">
        <Icon name="info" />
        <div><small>PROTOTYPE GUIDE</small><h2>Built for a Mercedes-Benz workshop tool register.</h2><p>This mock-up shows how the workshop can move beyond a static spreadsheet while keeping Excel as the temporary data source.</p></div>
      </div>
      <div className="infogrid">
        {information.map(([number, title, description]) => (
          <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>
        ))}
      </div>
      <article className="card workflow">
        <CardHeading caption="RECOMMENDED WORKFLOW" title="From prototype to workshop system" />
        <div>
          {["Import register", "Operate live", "Review insight", "Move online"].map((title, index) => (
            <span key={title}><b>{index + 1}</b><strong>{title}</strong><small>{["Fictional demo workbook data", "Check out, return, inspect", "Usage and overdue tools", "Database and staff access"][index]}</small></span>
          ))}
        </div>
      </article>
    </section>
  );
}
