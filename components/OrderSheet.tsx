import type { Entry, OrderGroup } from "@/lib/aggregate";
import { itemLabel } from "@/lib/exports";
import { formatRupees, lineTotal, type Prices } from "@/lib/money";

type Props = {
  groups: OrderGroup[];
  building: boolean;
  prices: Prices;
  priceTexts: Record<string, string>; // exactly what's typed in each price box
  onPriceChange: (key: string, text: string) => void;
  onFix: (entryId: string, quantity: number | null) => void;
};

// "3", "3 + ?" when someone's quantity is unknown, or "?" when nobody's is known.
function quantityLabel(group: OrderGroup): string {
  const hasUnknown = group.entries.some((entry) => entry.quantity === null);
  if (!hasUnknown) return String(group.totalQuantity);
  return group.totalQuantity > 0 ? `${group.totalQuantity} + ?` : "?";
}

// Entries the organiser should see without opening the row:
// unknown quantities, ones they already fixed, and ones with a note.
const needsInput = (entry: Entry) => entry.quantity === null || entry.fixed || entry.flagged;

// One row per item: quantity, unit price, line total.
export default function OrderSheet({ groups, building, prices, priceTexts, onPriceChange, onFix }: Props) {
  return (
    <section className="rounded-lg bg-paper p-4 shadow-sm">
      <h2 className="mb-3 font-medium">Order sheet</h2>
      {groups.length === 0 ? (
        <p className="text-sm">{building ? "Items appear here as messages are read." : "No items in this chat yet."}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {groups.map((group) => {
            const label = itemLabel(group.name, group.variant);
            return (
              <li key={group.key} className={`space-y-2 px-2 py-3 ${group.flagged ? "bg-highlight" : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg">{label}</span>
                  <span className="shrink-0">× {quantityLabel(group)}</span>
                </div>

                {group.entries.filter(needsInput).map((entry) => (
                  <div key={entry.id} className="text-sm">
                    <label className="flex flex-wrap items-center gap-2">
                      <span>
                        {entry.sender} said “{entry.source}”. How many?
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={entry.quantity ?? ""}
                        onChange={(e) => {
                          const quantity = e.target.value === "" ? null : Number(e.target.value);
                          if (quantity === null || (Number.isInteger(quantity) && quantity >= 0)) {
                            onFix(entry.id, quantity);
                          }
                        }}
                        aria-label={`Quantity of ${label} for ${entry.sender}`}
                        className="w-16 rounded border border-ink bg-paper px-2 py-1"
                      />
                    </label>
                    {!entry.fixed && entry.notes.map((note, i) => <p key={i}>⚠ {note}</p>)}
                  </div>
                ))}

                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1 text-sm">
                    ₹
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={priceTexts[group.key] ?? ""}
                      onChange={(e) => onPriceChange(group.key, e.target.value)}
                      placeholder="price"
                      aria-label={`Price of one ${label}, in rupees`}
                      className="w-20 rounded border border-rule bg-paper px-2 py-1"
                    />
                    each
                  </label>
                  <span className="font-medium">
                    {group.key in prices ? formatRupees(lineTotal(group, prices)) : "—"}
                  </span>
                </div>

                <details className="text-sm">
                  <summary className="cursor-pointer opacity-75">Who asked ({group.entries.length})</summary>
                  <ul className="mt-1 space-y-1">
                    {group.entries.map((entry) => (
                      <li key={entry.id}>
                        <span className="font-medium">{entry.sender}</span> × {entry.quantity ?? "?"}{" "}
                        <span className="opacity-75">“{entry.source}”</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
