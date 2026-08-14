import type { CSSProperties } from "react";
import {
  Employee,
  InventoryItem,
  MovementType,
  Tab,
  formatElapsed,
  requiresAttention,
} from "../lib/inventory";
import { Icon } from "./icon";
import { CardHeading, EmptyState } from "./shared";

type DashboardStyle = CSSProperties & Record<`--${string}`, string | number>;

const MOVEMENT_LABELS: Record<MovementType, string> = {
  "checked-out": "Checked out",
  returned: "Returned",
  "handed-off": "Handed off",
};

function percentage(value: number, total: number): number {
  return total ? Math.round((value / total) * 100) : 0;
}

export function DashboardView({
  items,
  employees,
  checkedOut,
  overdue,
  attentionCount,
  locationCount,
  ranked,
  now,
  navigate,
}: {
  items: readonly InventoryItem[];
  employees: readonly Employee[];
  checkedOut: readonly InventoryItem[];
  overdue: readonly InventoryItem[];
  attentionCount: number;
  locationCount: number;
  ranked: readonly InventoryItem[];
  now: number;
  navigate: (tab: Tab) => void;
}) {
  const totalQuantity = items.reduce((total, item) => total + item.qty, 0);
  const ready = items.filter(
    (item) => item.status === "available" && !requiresAttention(item),
  );
  const activeEmployees = new Set(
    checkedOut.map((item) => item.holderId).filter(Boolean),
  ).size;
  const totalUsage = items.reduce((total, item) => total + item.usageCount, 0);
  const averageUsage = items.length ? Math.round(totalUsage / items.length) : 0;
  const readyPercent = percentage(ready.length, items.length);
  const checkedOutPercent = percentage(checkedOut.length, items.length);
  const attentionPercent = Math.max(
    0,
    100 - readyPercent - checkedOutPercent,
  );
  const overduePercent = percentage(overdue.length, checkedOut.length);
  const health = percentage(items.length - attentionCount, items.length);
  const maxUsage = ranked[0]?.usageCount || 1;

  const locationSummary = Array.from(
    items.reduce((summary, item) => {
      const current = summary.get(item.location) ?? {
        name: item.location,
        records: 0,
        quantity: 0,
        checkedOut: 0,
        attention: 0,
      };
      current.records += 1;
      current.quantity += item.qty;
      current.checkedOut += item.status === "checked-out" ? 1 : 0;
      current.attention += requiresAttention(item) ? 1 : 0;
      summary.set(item.location, current);
      return summary;
    }, new Map<string, { name: string; records: number; quantity: number; checkedOut: number; attention: number }>()),
  )
    .map(([, value]) => value)
    .sort((left, right) => right.records - left.records || left.name.localeCompare(right.name));
  const locationMax = locationSummary[0]?.records || 1;

  const employeeSummary = employees.map((employee) => {
    const assigned = checkedOut.filter(
      (item) => item.holderId === employee.id,
    );
    return {
      ...employee,
      assigned,
      overdue: assigned.filter((item) => overdue.some((late) => late.id === item.id)),
    };
  });
  const maxEmployeeLoad = Math.max(
    1,
    ...employeeSummary.map((employee) => employee.assigned.length),
  );

  const recentMovements = items
    .filter(
      (item) =>
        item.lastMovementType &&
        item.lastMovementBy &&
        typeof item.lastMovementAt === "number",
    )
    .sort(
      (left, right) =>
        (right.lastMovementAt ?? 0) - (left.lastMovementAt ?? 0),
    )
    .slice(0, 6);
  const attentionItems = items.filter(requiresAttention).slice(0, 5);

  const statusTone = overdue.length
    ? "critical"
    : attentionCount
      ? "watch"
      : "controlled";
  const statusTitle = overdue.length
    ? `${overdue.length} tool${overdue.length === 1 ? "" : "s"} need follow-up`
    : attentionCount
      ? `${attentionCount} inspection item${attentionCount === 1 ? "" : "s"} open`
      : "Workshop inventory is controlled";
  const statusCopy = overdue.length
    ? "Start with overdue custody, then clear the inspection queue."
    : attentionCount
      ? "Custody is current. Resolve condition flags before returning tools to service."
      : "All serviceable tools are available or assigned with no active alerts.";

  return (
    <section className="dashboard-v2">
      <section className={`ops-brief ${statusTone}`} aria-labelledby="operations-brief-title">
        <div className="ops-brief-copy">
          <span className="live-pill"><i /> LIVE WORKSHOP SNAPSHOT</span>
          <h2 id="operations-brief-title">{statusTitle}</h2>
          <p>{statusCopy}</p>
          <div className="brief-actions">
            <button type="button" onClick={() => navigate(overdue.length ? "Checked Out" : "Tools")}>
              {overdue.length ? "Review overdue tools" : "Open tool register"}
            </button>
            <button type="button" onClick={() => navigate("Workshop Desk")}>Open workshop desk</button>
          </div>
        </div>
        <div className="brief-control" aria-label="Live control rules">
          <span><Icon name="clock" /><small>Demo alert threshold</small><strong>30 seconds</strong></span>
          <span><Icon name="users" /><small>Employees holding tools</small><strong>{activeEmployees} of {employees.length}</strong></span>
          <span><Icon name="tools" /><small>Register health</small><strong>{health}% serviceable</strong></span>
        </div>
      </section>

      <section className="dashboard-kpis" aria-label="Workshop key performance indicators">
        <article className="primary">
          <span className="kpi-icon"><Icon name="tools" /></span>
          <div><small>Total tool quantity</small><strong>{totalQuantity.toLocaleString()}</strong><p>{items.length} fictional register records</p></div>
        </article>
        <article>
          <small>Ready now</small><strong>{ready.length}</strong>
          <p><b className="positive">{readyPercent}%</b> of register records</p>
          <i className="kpi-track"><b style={{ width: `${readyPercent}%` }} /></i>
        </article>
        <article>
          <small>Live custody</small><strong>{checkedOut.length}</strong>
          <p>{activeEmployees} active holder{activeEmployees === 1 ? "" : "s"}</p>
          <i className="kpi-track blue"><b style={{ width: `${checkedOutPercent}%` }} /></i>
        </article>
        <article>
          <small>Needs attention</small><strong>{attentionCount}</strong>
          <p><b className={attentionCount ? "warning" : "positive"}>{attentionCount ? "Inspection required" : "No condition flags"}</b></p>
          <i className="kpi-track amber"><b style={{ width: `${attentionPercent}%` }} /></i>
        </article>
        <article>
          <small>Average lifetime use</small><strong>{averageUsage}</strong>
          <p>{totalUsage.toLocaleString()} recorded uses</p>
          <span className="kpi-context">Across {locationCount} demo locations</span>
        </article>
      </section>

      <section className="dashboard-board">
        <article className="card status-mix">
          <CardHeading caption="REGISTER COMPOSITION" title="Tool availability mix" action="View tools" onAction={() => navigate("Tools")} />
          <div className="status-mix-body">
            <div
              className="status-donut"
              role="img"
              aria-label={`${ready.length} ready, ${checkedOut.length} checked out, ${attentionCount} needing attention`}
              style={{
                background: `conic-gradient(#2b9565 0 ${readyPercent}%, #0877c9 ${readyPercent}% ${readyPercent + checkedOutPercent}%, #dd8b3e ${readyPercent + checkedOutPercent}% 100%)`,
              }}
            >
              <span><strong>{items.length}</strong><small>records</small></span>
            </div>
            <div className="status-legend">
              <span className="ready"><i /><b>{ready.length}</b><small>Ready now · {readyPercent}%</small></span>
              <span className="out"><i /><b>{checkedOut.length}</b><small>Checked out · {checkedOutPercent}%</small></span>
              <span className="attention"><i /><b>{attentionCount}</b><small>Attention · {attentionPercent}%</small></span>
            </div>
          </div>
        </article>

        <article className="card custody-panel">
          <CardHeading caption="PEOPLE & CUSTODY" title="Employee tool load" action="Employees" onAction={() => navigate("Employees")} />
          <div className="custody-bars">
            {employeeSummary.map((employee) => (
              <button type="button" key={employee.id} onClick={() => navigate("Checked Out")}>
                <em>{employee.initials}</em>
                <span><strong>{employee.name}</strong><small>{employee.role}</small><i><b style={{ width: `${(employee.assigned.length / maxEmployeeLoad) * 100}%` }} /></i></span>
                <b>{employee.assigned.length}<small>held</small></b>
                {employee.overdue.length ? <mark>{employee.overdue.length} late</mark> : <mark className="clear">Current</mark>}
              </button>
            ))}
          </div>
        </article>

        <article className="card alert-panel">
          <CardHeading caption="PRIORITY QUEUE" title="Overdue custody" action="Open queue" onAction={() => navigate("Checked Out")} />
          <div className="alert-gauge" aria-label={`${overduePercent}% of checked-out tools are over the demo threshold`}>
            <span><strong>{overduePercent}%</strong><small>of tools out</small></span>
            <i><b style={{ width: `${overduePercent}%` }} /></i>
            <p>{overdue.length} overdue of {checkedOut.length} checked out</p>
          </div>
          {overdue.length ? (
            <div className="alert-list">
              {overdue.slice(0, 4).map((item) => (
                <button type="button" key={item.id} onClick={() => navigate("Checked Out")}>
                  <Icon name="clock" />
                  <span><strong>{item.description}</strong><small>{item.holder} · {item.location}</small></span>
                  <b>{formatElapsed(now - (item.checkedOutAt ?? now))}</b>
                </button>
              ))}
            </div>
          ) : <EmptyState title="No overdue tools" description="Every active checkout is within the demo threshold." />}
        </article>

        <article className="card location-map">
          <CardHeading caption="STORAGE DISTRIBUTION" title="Location load map" action="Tool register" onAction={() => navigate("Tools")} />
          <p className="card-intro">Larger, darker tiles contain more register records. Badges expose live custody and condition pressure.</p>
          <div className="location-heat" role="list" aria-label="Inventory records by storage location">
            {locationSummary.slice(0, 8).map((location) => {
              const intensity = Math.round((location.records / locationMax) * 100);
              return (
                <button
                  type="button"
                  role="listitem"
                  key={location.name}
                  onClick={() => navigate("Tools")}
                  style={{ "--heat": `${Math.max(16, intensity)}%` } as DashboardStyle}
                >
                  <span><strong>{location.name}</strong><small>{location.quantity} total quantity</small></span>
                  <b>{location.records}<small>records</small></b>
                  <footer>
                    <em>{location.checkedOut} out</em>
                    <em className={location.attention ? "flag" : "clear"}>{location.attention} flagged</em>
                  </footer>
                </button>
              );
            })}
          </div>
          {locationSummary.length > 8 ? <p className="location-more">+ {locationSummary.length - 8} additional locations in the tool register</p> : null}
        </article>

        <article className="card usage-rank">
          <CardHeading caption="UTILISATION" title="Most-used tools" action="Full report" onAction={() => navigate("Usage")} />
          <p className="card-intro">Lifetime checkout count highlights demand, duplicate-tool needs, and service planning.</p>
          <div className="usage-columns" role="list" aria-label="Most-used workshop tools">
            {ranked.slice(0, 6).map((item, index) => (
              <div role="listitem" key={item.id}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span><strong>{item.description}</strong><small>{item.partNumber} · {item.location}</small><i><em style={{ width: `${(item.usageCount / maxUsage) * 100}%` }} /></i></span>
                <strong>{item.usageCount}<small>uses</small></strong>
              </div>
            ))}
          </div>
        </article>

        <article className="card movement-feed">
          <CardHeading caption="AUDIT SNAPSHOT" title="Recent tool movement" action="Checked out" onAction={() => navigate("Checked Out")} />
          {recentMovements.length ? (
            <ol>
              {recentMovements.map((item) => (
                <li key={item.id}>
                  <i className={item.lastMovementType} />
                  <span><strong>{MOVEMENT_LABELS[item.lastMovementType!]}</strong><small>{item.description}</small><em>{item.lastMovementBy} · {item.holder ? `Now with ${item.holder}` : "Back in workshop"}</em></span>
                  <time>{formatElapsed(Math.max(0, now - (item.lastMovementAt ?? now)))} ago</time>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="No movement recorded yet" description="Checkouts, returns, and handoffs will appear here." />}
        </article>

        <article className="card condition-queue">
          <CardHeading caption="CONDITION CONTROL" title="Inspection queue" action="Needs attention" onAction={() => navigate("Tools")} />
          <div className="condition-summary">
            <span><strong>{attentionCount}</strong><small>open flags</small></span>
            <span><strong>{items.filter((item) => item.damaged).length}</strong><small>marked damaged</small></span>
            <span><strong>{items.filter((item) => item.missingParts.trim()).length}</strong><small>missing parts</small></span>
          </div>
          {attentionItems.length ? (
            <div className="condition-table" role="table" aria-label="Tools requiring workshop attention">
              <div role="row" className="condition-head"><span role="columnheader">Tool</span><span role="columnheader">Location</span><span role="columnheader">Reason</span></div>
              {attentionItems.map((item) => (
                <button type="button" role="row" key={item.id} onClick={() => navigate("Tools")}>
                  <span role="cell"><strong>{item.description}</strong><small>{item.partNumber}</small></span>
                  <span role="cell">{item.location}</span>
                  <span role="cell"><em>{item.damaged ? "Damage" : "Parts"}</em>{item.missingParts || "Inspection required"}</span>
                </button>
              ))}
            </div>
          ) : <EmptyState title="No condition flags" description="All registered tools are serviceable." />}
        </article>
      </section>
    </section>
  );
}
