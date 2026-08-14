import {
  EMPLOYEES,
  InventoryItem,
  Tab,
  formatElapsed,
} from "../lib/inventory";
import { Icon } from "./icon";
import { CardHeading, EmptyState } from "./shared";

export function DashboardView({
  items,
  checkedOut,
  overdue,
  attentionCount,
  locationCount,
  ranked,
  now,
  navigate,
}: {
  items: readonly InventoryItem[];
  checkedOut: readonly InventoryItem[];
  overdue: readonly InventoryItem[];
  attentionCount: number;
  locationCount: number;
  ranked: readonly InventoryItem[];
  now: number;
  navigate: (tab: Tab) => void;
}) {
  const maxUsage = ranked[0]?.usageCount || 1;
  const health = items.length
    ? Math.round(((items.length - attentionCount) / items.length) * 100)
    : 100;

  return (
    <>
      <section className="metrics" aria-label="Inventory summary">
        <article className="blue">
          <Icon name="tools" />
          <span><small>Total tool quantity</small><strong>{items.reduce((total, item) => total + item.qty, 0).toLocaleString()}</strong><p>{items.length} register records</p></span>
        </article>
        <article><small>Available now</small><strong>{items.length - checkedOut.length}</strong><p className="green">● Ready for use</p></article>
        <article><small>Checked out</small><strong>{checkedOut.length}</strong><p>Held by {new Set(checkedOut.map((item) => item.holder)).size} employees</p></article>
        <article><small>Over 30 seconds</small><strong>{overdue.length}</strong><p className={overdue.length ? "red" : ""}>{overdue.length ? "Follow-up recommended" : "Nothing overdue"}</p></article>
      </section>
      <section className="dashgrid">
        <article className="card">
          <CardHeading caption="LIVE ASSIGNMENTS" title="Who has which tools" action="View all" onAction={() => navigate("Checked Out")} />
          <div className="people">
            {EMPLOYEES.map((employee) => {
              const assigned = checkedOut.filter((item) => item.holderId === employee.id);
              return (
                <button type="button" key={employee.id} onClick={() => navigate("Checked Out")}>
                  <em>{employee.initials}</em>
                  <span><strong>{employee.name}</strong><small>{assigned.length ? assigned.map((item) => item.partNumber || item.description).slice(0, 2).join(" · ") : "No tools assigned"}</small></span>
                  <b>{assigned.length}</b>
                </button>
              );
            })}
          </div>
        </article>
        <article className="card">
          <CardHeading caption="USAGE INSIGHT" title="Most-used tools" action="Usage report" onAction={() => navigate("Usage")} />
          <div className="uselist">
            {ranked.slice(0, 5).map((item, index) => (
              <div key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.description}</strong><small>{item.partNumber || item.location}</small><i><b style={{ width: `${(item.usageCount / maxUsage) * 100}%` }} /></i></div>
                <em>{item.usageCount} uses</em>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <CardHeading caption="TIME ALERTS" title="Out longer than 30 seconds" action="Checked out" onAction={() => navigate("Checked Out")} />
          {overdue.length ? (
            <div className="late">
              {overdue.map((item) => (
                <div key={item.id}>
                  <i><Icon name="clock" /></i>
                  <span><strong>{item.description}</strong><small>{item.holder} · {item.location}</small></span>
                  <b>{formatElapsed(now - (item.checkedOutAt ?? now))}</b>
                </div>
              ))}
            </div>
          ) : <EmptyState />}
        </article>
        <article className="card health">
          <CardHeading caption="REGISTER HEALTH" title="Workshop overview" />
          <div>
            <b style={{ "--score": `${health}%` } as React.CSSProperties}><span>{health}%</span><small>serviceable</small></b>
            <p><span>● Available or assigned <strong>{items.length - attentionCount}</strong></span><span>● Needs attention <strong>{attentionCount}</strong></span><span>● Storage locations <strong>{locationCount}</strong></span></p>
          </div>
        </article>
      </section>
    </>
  );
}
