import { InventoryFilter, InventoryItem } from "../lib/inventory";
import { Icon } from "./icon";
import { ToolTable } from "./tool-table";

export function ToolsView({
  items,
  totalMatches,
  locations,
  query,
  location,
  filter,
  now,
  onQueryChange,
  onLocationChange,
  onFilterChange,
  onImport,
  onCheckOut,
  onReturn,
}: {
  items: readonly InventoryItem[];
  totalMatches: number;
  locations: readonly string[];
  query: string;
  location: string;
  filter: InventoryFilter;
  now: number;
  onQueryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onFilterChange: (value: InventoryFilter) => void;
  onImport: () => void;
  onCheckOut: (item: InventoryItem) => void;
  onReturn: (item: InventoryItem) => void;
}) {
  return (
    <section className="toolspage">
      <div className="toolhero">
        <div><small>REAL INVENTORY</small><h2>Find the right workshop tool.</h2><p>Search by part number, tool name, storage area, or current holder.</p></div>
        <button type="button" className="dark" onClick={onImport}><Icon name="up" />Replace from Excel</button>
      </div>
      <div className="filters">
        <label>
          <span className="sr-only">Search tools</span>
          <Icon name="search" />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search part number, description, location or employee…" />
        </label>
        <select value={location} onChange={(event) => onLocationChange(event.target.value)} aria-label="Filter by storage location">
          <option>All locations</option>
          {locations.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select value={filter} onChange={(event) => onFilterChange(event.target.value as InventoryFilter)} aria-label="Filter by tool status">
          <option>All tools</option><option>Available</option><option>Checked out</option><option>Needs attention</option>
        </select>
        <b>{totalMatches} matches</b>
      </div>
      <ToolTable items={items} now={now} onCheckOut={onCheckOut} onReturn={onReturn} />
      <p className="note">Showing up to 120 matching records. Search or filter to narrow the register.</p>
    </section>
  );
}
