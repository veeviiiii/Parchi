import type { OrderGroup } from "@/lib/aggregate";
import { itemLabel } from "@/lib/exports";

type Props = {
  groups: OrderGroup[];
  building: boolean;
};

// "3", "3 + ?" when someone's quantity is unknown, or "?" when nobody's is known.
function quantityLabel(group: OrderGroup): string {
  const hasUnknown = group.entries.some((entry) => entry.quantity === null);
  if (!hasUnknown) return String(group.totalQuantity);
  return group.totalQuantity > 0 ? `${group.totalQuantity} + ?` : "?";
}

// One row per item. Tap a row to see who asked for it and their exact words.
export default function OrderSheet({ groups, building }: Props) {
  return (
    <section className="rounded-lg bg-paper p-4 shadow-sm">
      <h2 className="mb-3 font-medium">Order sheet</h2>
      {groups.length === 0 ? (
        <p className="text-sm">{building ? "Items appear here as messages are read." : "No items in this chat yet."}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {groups.map((group) => (
            <li key={group.key} className={group.flagged ? "bg-highlight" : ""}>
              <details>
                <summary className="flex cursor-pointer items-baseline justify-between gap-2 px-2 py-2">
                  <span className="text-lg">{itemLabel(group.name, group.variant)}</span>
                  <span className="shrink-0">× {quantityLabel(group)}</span>
                </summary>
                <ul className="space-y-1 px-2 pb-2 text-sm">
                  {group.entries.map((entry) => (
                    <li key={entry.id}>
                      <span className="font-medium">{entry.sender}</span> × {entry.quantity ?? "?"}{" "}
                      <span className="opacity-75">“{entry.source}”</span>
                      {entry.notes.map((note, i) => (
                        <span key={i} className="block">
                          ⚠ {note}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
