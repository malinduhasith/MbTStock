"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  EMPLOYEES,
  InventoryFilter,
  InventoryItem,
  Tab,
  checkOutTool,
  createDemoInventory,
  filterInventory,
  getLocations,
  getMostUsed,
  isCheckedOut,
  isOverdue,
  requiresAttention,
  returnTool,
} from "../lib/inventory";
import {
  downloadInventoryWorkbook,
  readInventoryWorkbook,
} from "../lib/excel";
import { loadInventory, saveInventory } from "../lib/storage";
import { CheckoutDialog } from "./checkout-dialog";
import { DashboardView } from "./dashboard-view";
import { Icon, IconName } from "./icon";
import {
  CheckedOutView,
  EmployeesView,
  InfoView,
  UsageView,
} from "./reports-views";
import { ToolsView } from "./tools-view";

const NAVIGATION: readonly [Tab, IconName][] = [
  ["Dashboard", "dashboard"],
  ["Tools", "tools"],
  ["Checked Out", "out"],
  ["Usage", "usage"],
  ["Employees", "users"],
  ["Info", "info"],
];

export function WorkshopApp({ seed }: { seed: readonly InventoryItem[] }) {
  const [items, setItems] = useState<InventoryItem[]>(() =>
    createDemoInventory(seed),
  );
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("All locations");
  const [filter, setFilter] = useState<InventoryFilter>("All tools");
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [employeeId, setEmployeeId] = useState(EMPLOYEES[0].id);
  const [notice, setNotice] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    const hydrationTask = window.setTimeout(() => {
      const saved = loadInventory();
      if (saved) setItems(saved);
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTask);
  }, []);

  useEffect(() => {
    if (storageReady) saveInventory(items);
  }, [items, storageReady]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const locations = useMemo(() => getLocations(items), [items]);
  const checkedOut = useMemo(() => items.filter(isCheckedOut), [items]);
  const overdue = useMemo(
    () => checkedOut.filter((item) => isOverdue(item, now)),
    [checkedOut, now],
  );
  const attentionCount = useMemo(
    () => items.filter(requiresAttention).length,
    [items],
  );
  const ranked = useMemo(() => getMostUsed(items), [items]);
  const filtered = useMemo(
    () => filterInventory(items, query, location, filter),
    [items, query, location, filter],
  );

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2_500);
  }, []);

  const navigate = useCallback((next: Tab) => {
    setTab(next);
    if (next !== "Tools") {
      setQuery("");
      setLocation("All locations");
      setFilter("All tools");
    }
  }, []);

  const closeDialog = useCallback(() => setSelected(null), []);

  function confirmCheckOut() {
    if (!selected) return;
    const employee = EMPLOYEES.find(
      (candidate) => candidate.id === employeeId,
    );
    if (!employee) {
      flash("Select a valid employee");
      return;
    }
    setItems((current) =>
      checkOutTool(current, selected.id, employee, Date.now()),
    );
    closeDialog();
    flash(`Checked out to ${employee.name}`);
  }

  function handleReturn(item: InventoryItem) {
    setItems((current) => returnTool(current, item.id));
    flash("Tool returned");
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = await readInventoryWorkbook(file);
      setItems(imported);
      navigate("Tools");
      flash(`${imported.length} records imported`);
    } catch (error) {
      flash(
        error instanceof Error
          ? error.message
          : "The workbook could not be imported.",
      );
    } finally {
      event.target.value = "";
    }
  }

  async function handleExport() {
    try {
      await downloadInventoryWorkbook(items);
      flash("Updated register downloaded");
    } catch {
      flash("The Excel register could not be created.");
    }
  }

  return (
    <div className="frame">
      <div className="shell">
        <aside>
          <div className="brand">
            <b aria-hidden="true"><i /><i /><i /></b>
            <span><strong>MbT Stock</strong><small>Workshop tool control</small></span>
          </div>
          <div className="manager">
            <em aria-hidden="true">RM</em>
            <span><strong>Register Manager</strong><small>Mercedes-Benz Workshop</small></span>
          </div>
          <nav aria-label="Primary navigation">
            {NAVIGATION.map(([label, icon]) => (
              <button
                type="button"
                key={label}
                className={tab === label ? "active" : ""}
                aria-current={tab === label ? "page" : undefined}
                onClick={() => navigate(label)}
              >
                <Icon name={icon} />
                <span>{label}</span>
                {label === "Checked Out" && checkedOut.length ? (
                  <b>{checkedOut.length}</b>
                ) : null}
              </button>
            ))}
          </nav>
          <div className="excel">
            <i aria-hidden="true" />
            <span><strong>Excel prototype</strong><small>Import, operate, then export the revised register.</small></span>
          </div>
          <div className="prototype">
            <Icon name="clock" />
            <span><strong>Prototype mode</strong><small>30-second overdue threshold</small></span>
          </div>
        </aside>
        <main>
          <header>
            <div><p>WORKSHOP OPERATIONS</p><h1>{tab}</h1></div>
            <div>
              <button type="button" className="iconbtn" onClick={() => navigate("Tools")} aria-label="Search tools"><Icon name="search" /></button>
              <input ref={fileInput} hidden type="file" accept=".xlsx,.xls" onChange={handleImport} />
              <button type="button" className="soft" onClick={() => fileInput.current?.click()}><Icon name="up" /><span>Import Excel</span></button>
              <button type="button" className="dark" onClick={handleExport}><Icon name="down" /><span>Export</span></button>
            </div>
          </header>
          {notice ? <div className="toast" role="status" aria-live="polite">{notice}</div> : null}
          {tab === "Dashboard" ? (
            <DashboardView items={items} checkedOut={checkedOut} overdue={overdue} attentionCount={attentionCount} locationCount={locations.length} ranked={ranked} now={now} navigate={navigate} />
          ) : null}
          {tab === "Tools" ? (
            <ToolsView items={filtered.slice(0, 120)} totalMatches={filtered.length} locations={locations} query={query} location={location} filter={filter} now={now} onQueryChange={setQuery} onLocationChange={setLocation} onFilterChange={setFilter} onImport={() => fileInput.current?.click()} onCheckOut={setSelected} onReturn={handleReturn} />
          ) : null}
          {tab === "Checked Out" ? (
            <CheckedOutView items={checkedOut} overdueCount={overdue.length} now={now} onReturn={handleReturn} />
          ) : null}
          {tab === "Usage" ? <UsageView items={ranked} /> : null}
          {tab === "Employees" ? <EmployeesView checkedOut={checkedOut} now={now} navigate={navigate} /> : null}
          {tab === "Info" ? <InfoView /> : null}
        </main>
        {selected ? (
          <CheckoutDialog item={selected} employeeId={employeeId} onEmployeeChange={setEmployeeId} onCancel={closeDialog} onConfirm={confirmCheckOut} />
        ) : null}
      </div>
    </div>
  );
}
