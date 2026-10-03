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

// A blank to write in, like "₹ ____ each" in a copy.
const blankInput =
  "rounded-none border-0 border-b-2 border-ink/40 bg-transparent px-1 text-base focus:border-ink [appearance:textfield]";

// The order sheet: a page from a single-line school notebook (CLAUDE.md section 13).
export default function OrderSheet({ groups, building, prices, priceTexts, onPriceChange, onFix }: Props) {
  return (
    <section className="notebook overflow-hidden rounded-sm shadow-sm" aria-labelledby="order-sheet">
      <h2 id="order-sheet" className="notebook-line font-semibold">
        Order sheet
      </h2>

      {groups.length === 0 ? (
        <>
          <p className="notebook-line font-hand text-xl opacity-75">
            {building ? "Writing items here as messages are read…" : "Your order will be written here."}
          </p>
          <div className="h-[calc(var(--rule)*2)]" aria-hidden />
        </>
      ) : (
        <ol>
          {groups.map((group, index) => {
            const label = itemLabel(group.name, group.variant);
            return (
              <li key={group.key} className="notebook-line relative">
                <span className="notebook-number font-hand text-lg" aria-hidden>
                  {index + 1}.
                </span>

                {/* Tap the item line to see who asked and their exact words. */}
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="font-hand text-xl">
                      {group.flagged ? <mark className="highlighter text-ink">{label}</mark> : label}
                    </span>
                    <span className="shrink-0 font-hand text-xl">
                      × {quantityLabel(group)}
                      <span className="ml-2 inline-block align-top text-sm opacity-75 group-open:rotate-90" aria-hidden>
                        ▸
                      </span>
                    </span>
                  </summary>
                  <ul className="text-sm">
                    {group.entries.map((entry) => (
                      <li key={entry.id}>
                        <span className="font-medium">{entry.sender}</span> × {entry.quantity ?? "?"}{" "}
                        <span className="opacity-75">“{entry.source}”</span>
                      </li>
                    ))}
                  </ul>
                </details>

                {group.entries.filter(needsInput).map((entry) => (
                  <div key={entry.id} className="text-sm">
                    <label>
                      {entry.sender}: “{entry.source}”{" "}
                      {entry.fixed ? "→" : <span className="highlighter">How many?</span>}{" "}
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
                        className={`w-14 ${blankInput}`}
                      />
                    </label>
                    {/* "How many?" is already asked above, so only other notes are shown here. */}
                    {!entry.fixed &&
                      entry.notes
                        .filter((note) => !/how many/i.test(note))
                        .map((note, i) => <p key={i}>⚠ {note}</p>)}
                  </div>
                ))}

                <div className="flex items-start justify-between gap-3">
                  <label className="text-sm">
                    ₹{" "}
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={priceTexts[group.key] ?? ""}
                      onChange={(e) => onPriceChange(group.key, e.target.value)}
                      aria-label={`Price of one ${label}, in rupees`}
                      className={`w-20 ${blankInput}`}
                    />{" "}
                    each
                  </label>
                  <span className="font-medium">
                    {group.key in prices ? formatRupees(lineTotal(group, prices)) : <span className="text-sm font-normal opacity-75">no price</span>}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* One blank ruled line at the bottom of the page. */}
      <div className="h-(--rule)" aria-hidden />
    </section>
  );
}
