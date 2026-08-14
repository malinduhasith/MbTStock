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
  Employee,
  InventoryFilter,
  InventoryItem,
  Tab,
  WorkshopMode,
  checkOutTool,
  createDemoInventory,
  filterInventory,
  getLocations,
  getMostUsed,
  getWorkshopDeskItems,
  handOffTool,
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
import { MechanicsView } from "./mechanics-view";
import { HandoffDialog } from "./handoff-dialog";

const NAVIGATION: readonly [Tab, IconName][] = [
  ["Workshop Desk", "tools"],
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
  const [tab, setTab] = useState<Tab>("Workshop Desk");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("All locations");
  const [filter, setFilter] = useState<InventoryFilter>("All tools");
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [handoffItem, setHandoffItem] =
    useState<InventoryItem | null>(null);
  const [employeeId, setEmployeeId] = useState(EMPLOYEES[0].id);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicMode, setMechanicMode] =
    useState<WorkshopMode>("check-out");
  const [mechanicQuery, setMechanicQuery] = useState("");
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
  const mechanicItems = useMemo(
    () =>
      getWorkshopDeskItems(
        items,
        mechanicMode,
        mechanicId,
        mechanicQuery,
      ),
    [items, mechanicMode, mechanicId, mechanicQuery],
  );
  const mechanicAssignments = useMemo(
    () => checkedOut.filter((item) => item.holderId === mechanicId),
    [checkedOut, mechanicId],
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
  const closeHandoffDialog = useCallback(() => setHandoffItem(null), []);

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

  function handleReturn(item: InventoryItem, performedById?: string) {
    const performedBy = EMPLOYEES.find(
      (employee) => employee.id === performedById,
    );
    setItems((current) =>
      returnTool(current, item.id, performedBy, Date.now()),
    );
    flash(
      performedBy
        ? `Tool returned by ${performedBy.name}`
        : "Tool returned",
    );
  }

  function confirmHandOff(recipient: Employee) {
    if (!handoffItem) return;
    const performedBy = EMPLOYEES.find(
      (employee) => employee.id === mechanicId,
    );
    if (!performedBy) return;
    setItems((current) =>
      handOffTool(
        current,
        handoffItem.id,
        recipient,
        performedBy,
        Date.now(),
      ),
    );
    closeHandoffDialog();
    flash(`Handed off to ${recipient.name}`);
  }

  function beginMechanicCheckOut(item: InventoryItem) {
    if (!mechanicId) return;
    setEmployeeId(mechanicId);
    setSelected(item);
  }

  function changeMechanic(nextEmployeeId: string) {
    setMechanicId(nextEmployeeId);
    setMechanicQuery("");
    setMechanicMode("check-out");
  }

  function changeMechanicMode(mode: WorkshopMode) {
    setMechanicMode(mode);
    setMechanicQuery("");
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
          {tab === "Workshop Desk" ? (
            <MechanicsView
              employeeId={mechanicId}
              mode={mechanicMode}
              query={mechanicQuery}
              items={mechanicItems}
              assigned={mechanicAssignments}
              now={now}
              onEmployeeChange={changeMechanic}
              onModeChange={changeMechanicMode}
              onQueryChange={setMechanicQuery}
              onCheckOut={beginMechanicCheckOut}
              onReturn={(item) => handleReturn(item, mechanicId)}
              onHandOff={setHandoffItem}
            />
          ) : null}
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
        {handoffItem && mechanicId ? (
          <HandoffDialog
            item={handoffItem}
            performedBy={
              EMPLOYEES.find((employee) => employee.id === mechanicId) ??
              EMPLOYEES[0]
            }
            onCancel={closeHandoffDialog}
            onConfirm={confirmHandOff}
          />
        ) : null}
      </div>
    </div>
  );
}
