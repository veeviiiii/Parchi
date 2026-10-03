// Text formatting for the order sheet and the copy buttons. Plain code only.
import type { OrderGroup } from "./aggregate";
import { formatRupees, whoOwes, type Prices } from "./money";

// "gel pen" + "blue" → "Gel pen (blue)"
export function itemLabel(name: string, variant: string | null): string {
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return variant ? `${label} (${variant})` : label;
}

// The list for the shopkeeper (CLAUDE.md section 12).
// Rows with no known quantity are left out: the shop can't fill "× ?".
export function shopText(groups: OrderGroup[]): string {
  const rows = groups.filter((group) => group.totalQuantity > 0);
  const lines = rows.map((group) => `• ${itemLabel(group.name, group.variant)} × ${group.totalQuantity}`);
  return [`Group order — ${rows.length} ${rows.length === 1 ? "item" : "items"}`, ...lines].join("\n");
}

// The list for the group chat (CLAUDE.md section 12).
export function whoOwesText(groups: OrderGroup[], prices: Prices): string {
  const lines = whoOwes(groups, prices).map(({ sender, amount }) => `${sender}: ${formatRupees(amount)}`);
  return ["Who owes what", ...lines].join("\n");
}

// Wraps a CSV value in quotes when it contains a comma, quote, or line break.
function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// One line per person per item, so it can be sorted or totalled in a spreadsheet.
export function orderCsv(groups: OrderGroup[], prices: Prices): string {
  const header = ["Item", "Variant", "Person", "Quantity", "Unit price", "Amount"];
  const rows = groups.flatMap((group) =>
    group.entries.map((entry) => {
      const price = prices[group.key] ?? null;
      const amount =
        entry.quantity !== null && price !== null ? Math.round(entry.quantity * price * 100) / 100 : null;
      return [itemLabel(group.name, null), group.variant, entry.sender, entry.quantity, price, amount];
    }),
  );
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
