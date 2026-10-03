import type { Order } from "@/lib/aggregate";
import { itemLabel } from "@/lib/exports";
import type { ChatMessage } from "@/lib/parseChat";
import type { ParseResult } from "@/lib/schema";

// Where each message is in its trip to Gemma and back.
export type ReadState =
  | { status: "reading" }
  | { status: "done"; result: ParseResult }
  | { status: "failed"; error: string };

type Props = {
  messages: ChatMessage[];
  reads: Record<string, ReadState>;
  order: Order;
  onRetry: (message: ChatMessage) => void;
};

const STATUS_LABEL = {
  added: "Added",
  cancelled: "Cancelled",
  ignored: "Ignored",
  needs_check: "Needs a check",
};

// Gemma's answer in words, e.g. "Notebook (single line) × 2" or "cancel → Notebook".
function describe(result: ParseResult): string {
  if (result.intent === "not_an_order") return "not an order";
  if (result.items.length === 0) return result.intent === "cancel" ? "cancel everything" : "no items";
  const items = result.items
    .map((item) => {
      const label = itemLabel(item.name, item.variant);
      if (item.quantity !== null) return `${label} × ${item.quantity}`;
      return result.intent === "add" ? `${label} × ?` : label;
    })
    .join(", ");
  return result.intent === "cancel" ? `cancel → ${items}` : items;
}

// "How each message was read": the AI showcase for judges.
export default function MessageList({ messages, reads, order, onRetry }: Props) {
  return (
    <details open className="rounded-lg bg-paper p-4 shadow-sm">
      <summary className="cursor-pointer font-medium">How each message was read ({messages.length})</summary>
      <ol className="mt-3 space-y-3">
        {messages.map((message) => {
          const read = reads[message.id];
          const outcome = order.messages[message.id];
          let label = "Waiting";
          if (read?.status === "reading") label = "Reading…";
          if (read?.status === "failed") label = "Couldn't read";
          if (outcome) label = STATUS_LABEL[outcome.status];
          const needsAttention = read?.status === "failed" || outcome?.status === "needs_check";

          return (
            <li key={message.id} className="border-b border-rule pb-3 last:border-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  {message.sender}
                  {message.time && <span className="ml-2 text-xs opacity-60">{message.time}</span>}
                </span>
                <span className={`shrink-0 rounded px-2 text-sm ${needsAttention ? "bg-highlight" : "bg-page"}`}>
                  {label}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line">{message.text}</p>
              {read?.status === "done" && (
                <p className="mt-1 text-sm opacity-75">Gemma read: {describe(read.result)}</p>
              )}
              {outcome?.notes.map((note, i) => (
                <p key={i} className="mt-1 text-sm">
                  ⚠ {note}
                </p>
              ))}
              {read?.status === "failed" && (
                <p className="mt-1 text-sm">
                  {read.error}{" "}
                  <button type="button" onClick={() => onRetry(message)} className="underline">
                    Retry
                  </button>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
