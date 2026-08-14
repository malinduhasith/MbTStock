import {
  InventoryItem,
  formatElapsed,
  requiresAttention,
} from "../lib/inventory";

export function ToolTable({
  items,
  now,
  onCheckOut,
  onReturn,
}: {
  items: readonly InventoryItem[];
  now: number;
  onCheckOut: (item: InventoryItem) => void;
  onReturn: (item: InventoryItem) => void;
}) {
  return (
    <div className="table">
      <table>
        <thead>
          <tr>
            <th scope="col">Tool / part number</th>
            <th scope="col">Storage area</th>
            <th scope="col">Qty</th>
            <th scope="col">Condition</th>
            <th scope="col">Workshop status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const checkedOut = item.status === "checked-out";
            const attention = requiresAttention(item);
            return (
              <tr key={item.id}>
                <td><strong>{item.description}</strong><small>{item.partNumber || "Unnumbered tool"}</small></td>
                <td><strong>{item.location}</strong><small>{item.source}</small></td>
                <td>{item.qty}</td>
                <td>
                  <em className={attention ? "attention" : "good"}>
                    {attention ? "Needs attention" : "Serviceable"}
                  </em>
                  {item.missingParts ? <small>{item.missingParts}</small> : null}
                </td>
                <td>
                  {checkedOut ? (
                    <><strong>{item.holder}</strong><small>{formatElapsed(now - (item.checkedOutAt ?? now))} in use</small></>
                  ) : (
                    <span className="available">● Available</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className={checkedOut ? "return" : "checkout"}
                    onClick={() => checkedOut ? onReturn(item) : onCheckOut(item)}
                    aria-label={`${checkedOut ? "Return" : "Check out"} ${item.description}`}
                  >
                    {checkedOut ? "Return" : "Check out"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
