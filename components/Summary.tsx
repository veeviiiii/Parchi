"use client";

import { useState } from "react";
import type { OrderGroup } from "@/lib/aggregate";
import { copyText, downloadText } from "@/lib/browser";
import { orderCsv, shopText, whoOwesText } from "@/lib/exports";
import { formatRupees, grandTotal, whoOwes, type Prices } from "@/lib/money";

type Props = {
  groups: OrderGroup[];
  prices: Prices;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Grand total, who owes what, and the copy / download buttons.
export default function Summary({ groups, prices }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [manualCopy, setManualCopy] = useState<string | null>(null); // shown if copying is blocked

  const missingPrice = groups.filter((group) => !(group.key in prices)).length;
  const missingQuantity = groups.filter((group) => group.entries.some((entry) => entry.quantity === null)).length;

  async function copy(text: string, note = "") {
    if (await copyText(text)) {
      setManualCopy(null);
      setFeedback(`Copied.${note}`);
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setManualCopy(text);
      setFeedback("Couldn't copy automatically. Select the text below and copy it.");
    }
  }

  const leftOut = groups.filter((group) => group.totalQuantity === 0).length;
  const shopNote = leftOut > 0 ? ` ${plural(leftOut, "item", "items")} without a quantity left out.` : "";

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

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(shopText(groups), shopNote)}
          className="rounded bg-ink px-4 py-2 font-medium text-paper"
        >
          Copy order for shop
        </button>
        <button
          type="button"
          onClick={() => copy(whoOwesText(groups, prices))}
          className="rounded border border-ink px-4 py-2"
        >
          Copy who owes what
        </button>
        <button
          type="button"
          onClick={() => downloadText("group-order.csv", orderCsv(groups, prices))}
          className="rounded border border-ink px-4 py-2"
        >
          Download CSV
        </button>
      </div>
      <p className="mt-2 min-h-5 text-sm" role="status">
        {feedback}
      </p>
      {manualCopy && (
        <textarea
          readOnly
          value={manualCopy}
          rows={manualCopy.split("\n").length}
          onFocus={(e) => e.target.select()}
          aria-label="Text to copy"
          className="mt-2 w-full rounded border border-rule p-2 font-mono text-sm"
        />
      )}
    </section>
  );
}
