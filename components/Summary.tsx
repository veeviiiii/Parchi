import type { OrderGroup } from "@/lib/aggregate";
import { formatRupees, grandTotal, whoOwes, type Prices } from "@/lib/money";

type Props = {
  groups: OrderGroup[];
  prices: Prices;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Grand total and who owes what. Updates as soon as a price or quantity changes.
export default function Summary({ groups, prices }: Props) {
  const missingPrice = groups.filter((group) => !(group.key in prices)).length;
  const missingQuantity = groups.filter((group) => group.entries.some((entry) => entry.quantity === null)).length;

  return (
    <section className="rounded-lg bg-paper p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">Total</h2>
        <span className="text-2xl font-semibold">{formatRupees(grandTotal(groups, prices))}</span>
      </div>

      {(missingPrice > 0 || missingQuantity > 0) && (
        <p className="mt-1 text-sm">
          {[
            missingPrice > 0 && `${plural(missingPrice, "item has", "items have")} no price yet.`,
            missingQuantity > 0 && `${plural(missingQuantity, "item still needs", "items still need")} a quantity.`,
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}

      <h3 className="mt-4 font-medium">Who owes what</h3>
      <ul className="mt-1">
        {whoOwes(groups, prices).map(({ sender, amount }) => (
          <li key={sender} className="flex justify-between border-b border-rule py-1 last:border-0">
            <span>{sender}</span>
            <span>{formatRupees(amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
