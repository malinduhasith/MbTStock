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
  CustodyAction,
  DataSource,
  Employee,
  InventoryFilter,
  InventoryItem,
  Tab,
  WorkshopMode,
  WorkshopDataset,
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
  const [employees, setEmployees] = useState<Employee[]>([...EMPLOYEES]);
  const [dataSource, setDataSource] = useState<DataSource>("demo");
  const [employeeId, setEmployeeId] = useState(EMPLOYEES[0].id);
  const [mechanicId, setMechanicId] = useState("");
  const [mechanicMode, setMechanicMode] =
    useState<WorkshopMode>("check-out");
  const [mechanicQuery, setMechanicQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | null>(null);

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2_500);
  }, []);

  const applyDataset = useCallback((dataset: WorkshopDataset) => {
    const activeEmployees = dataset.employees.filter(
      (employee) => employee.active,
    );
    setItems(dataset.items);
    setEmployees(activeEmployees);
    setDataSource(dataset.source);
    setEmployeeId((current) =>
      activeEmployees.some((employee) => employee.id === current)
        ? current
        : activeEmployees[0]?.id ?? "",
    );
    setMechanicId((current) =>
      activeEmployees.some((employee) => employee.id === current)
        ? current
        : "",
    );
  }, []);

  const refreshRepository = useCallback(
    async (initial = false) => {
      setSyncing(true);
      try {
        const response = await fetch("/api/workshop", { cache: "no-store" });
        const payload = (await response.json()) as WorkshopDataset & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Google Sheets could not be loaded.");
        }
        if (payload.source === "demo") {
          const saved = loadInventory();
          applyDataset({ ...payload, items: saved ?? payload.items });
        } else {
          applyDataset(payload);
        }
        if (!initial) {
          flash(
            payload.source === "google-sheets"
              ? "Google Sheets refreshed"
              : "Demo data refreshed",
          );
        }
      } catch (error) {
        if (initial) {
          const saved = loadInventory();
          if (saved) setItems(saved);
          setDataSource("demo");
          flash("Google Sheets unavailable — using browser demo data");
        } else {
          flash(
            error instanceof Error
              ? error.message
              : "Google Sheets could not be refreshed.",
          );
        }
      } finally {
        setStorageReady(true);
        setSyncing(false);
      }
    },
    [applyDataset, flash],
  );

  useEffect(() => {
    void refreshRepository(true);
  }, [refreshRepository]);

  useEffect(() => {
    if (storageReady && dataSource === "demo") saveInventory(items);
  }, [dataSource, items, storageReady]);

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

  async function recordAction(
    action: CustodyAction,
    localUpdate: (current: readonly InventoryItem[]) => InventoryItem[],
    successMessage: string,
  ): Promise<boolean> {
    if (syncing) return false;
    if (dataSource === "demo") {
      setItems((current) => localUpdate(current));
      flash(successMessage);
      return true;
    }

    setSyncing(true);
    try {
      const response = await fetch("/api/workshop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const payload = (await response.json()) as WorkshopDataset & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "The tool movement could not be saved.");
      }
      applyDataset(payload);
      flash(successMessage);
      return true;
    } catch (error) {
      flash(
        error instanceof Error
          ? error.message
          : "The tool movement could not be saved.",
      );
      return false;
    } finally {
      setSyncing(false);
    }
  }

  async function confirmCheckOut() {
    if (!selected) return;
    const employee = employees.find(
      (candidate) => candidate.id === employeeId,
    );
    if (!employee) {
      flash("Select a valid employee");
      return;
    }
    const saved = await recordAction(
      {
        type: "check-out",
        toolId: selected.id,
        employeeId: employee.id,
        expectedVersion: selected.rowVersion ?? 1,
      },
      (current) => checkOutTool(current, selected.id, employee, Date.now()),
      `Checked out to ${employee.name}`,
    );
    if (saved) closeDialog();
  }

  async function handleReturn(item: InventoryItem, performedById?: string) {
    const performedBy = employees.find(
      (employee) => employee.id === performedById,
    );
    if (!performedBy) {
      navigate("Workshop Desk");
      flash("Select your employee profile before returning a tool");
      return;
    }
    await recordAction(
      {
        type: "return",
        toolId: item.id,
        performedByEmployeeId: performedBy.id,
        expectedVersion: item.rowVersion ?? 1,
      },
      (current) => returnTool(current, item.id, performedBy, Date.now()),
      `Tool returned by ${performedBy.name}`,
    );
  }

  async function confirmHandOff(recipient: Employee) {
    if (!handoffItem) return;
    const performedBy = employees.find(
      (employee) => employee.id === mechanicId,
    );
    if (!performedBy) return;
    const saved = await recordAction(
      {
        type: "hand-off",
        toolId: handoffItem.id,
        performedByEmployeeId: performedBy.id,
        recipientEmployeeId: recipient.id,
        expectedVersion: handoffItem.rowVersion ?? 1,
      },
      (current) => handOffTool(
        current,
        handoffItem.id,
        recipient,
        performedBy,
        Date.now(),
      ),
      `Handed off to ${recipient.name}`,
    );
    if (saved) closeHandoffDialog();
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

  const sheetsConnected = dataSource === "google-sheets";

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
            <span><strong>{sheetsConnected ? "Google Sheets connected" : "Browser demo mode"}</strong><small>{sheetsConnected ? "Tools, employees and movement history are shared." : "Fictional data is saved only in this browser."}</small></span>
          </div>
          <div className="prototype">
            <Icon name="clock" />
            <span><strong>Prototype mode</strong><small>30-second overdue threshold</small></span>
          </div>
        </aside>
        <main aria-busy={syncing}>
          <header>
            <div><p>WORKSHOP OPERATIONS</p><h1>{tab}</h1></div>
            <div>
              <button type="button" className="iconbtn" onClick={() => navigate("Tools")} aria-label="Search tools"><Icon name="search" /></button>
              <input ref={fileInput} hidden type="file" accept=".xlsx,.xls" onChange={handleImport} />
              <button type="button" className="soft" disabled={syncing} onClick={() => sheetsConnected ? void refreshRepository() : fileInput.current?.click()}><Icon name="up" /><span>{sheetsConnected ? (syncing ? "Syncing…" : "Refresh Sheets") : "Import Excel"}</span></button>
              <button type="button" className="dark" onClick={handleExport}><Icon name="down" /><span>Export</span></button>
            </div>
          </header>
          {notice ? <div className="toast" role="status" aria-live="polite">{notice}</div> : null}
          {tab === "Workshop Desk" ? (
            <MechanicsView
              employeeId={mechanicId}
              employees={employees}
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
            <DashboardView items={items} employees={employees} checkedOut={checkedOut} overdue={overdue} attentionCount={attentionCount} locationCount={locations.length} ranked={ranked} now={now} navigate={navigate} />
          ) : null}
          {tab === "Tools" ? (
            <ToolsView items={filtered.slice(0, 120)} totalMatches={filtered.length} locations={locations} query={query} location={location} filter={filter} now={now} connected={sheetsConnected} syncing={syncing} onQueryChange={setQuery} onLocationChange={setLocation} onFilterChange={setFilter} onImport={() => fileInput.current?.click()} onRefresh={() => void refreshRepository()} onCheckOut={setSelected} onReturn={handleReturn} />
          ) : null}
          {tab === "Checked Out" ? (
            <CheckedOutView items={checkedOut} employees={employees} overdueCount={overdue.length} now={now} onReturn={handleReturn} />
          ) : null}
          {tab === "Usage" ? <UsageView items={ranked} /> : null}
          {tab === "Employees" ? <EmployeesView checkedOut={checkedOut} employees={employees} now={now} navigate={navigate} /> : null}
          {tab === "Info" ? <InfoView /> : null}
        </main>
        {selected ? (
          <CheckoutDialog item={selected} employees={employees} employeeId={employeeId} onEmployeeChange={setEmployeeId} onCancel={closeDialog} onConfirm={confirmCheckOut} />
        ) : null}
        {handoffItem && mechanicId && employees.length ? (
          <HandoffDialog
            item={handoffItem}
            employees={employees}
            performedBy={
              employees.find((employee) => employee.id === mechanicId) ??
              employees[0]
            }
            onCancel={closeHandoffDialog}
            onConfirm={confirmHandOff}
          />
        ) : null}
      </div>
    </div>
  );
}
