// Turns Gemma's per-message answers into one grouped order (CLAUDE.md section 11).
// Plain code only: Gemma never sees this step.
import type { ChatMessage } from "./parseChat";
import type { ParseResult } from "./schema";

export type MessageStatus = "added" | "cancelled" | "ignored" | "needs_check";

// One person's request for one item.
export type Entry = {
  id: string; // message id + item position, e.g. "m3-1"
  messageId: string;
  sender: string;
  name: string;
  variant: string | null;
  quantity: number | null;
  source: string;
  notes: string[];
  fixed: boolean; // the organiser typed this quantity
  flagged: boolean;
};

// One row of the order sheet: everyone's requests for the same item.
export type OrderGroup = {
  key: string;
  name: string;
  variant: string | null;
  totalQuantity: number;
  entries: Entry[];
  flagged: boolean;
};

export type Order = {
  groups: OrderGroup[];
  messages: Record<string, { status: MessageStatus; notes: string[] }>;
};

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export const groupKey = (name: string, variant: string | null) =>
  `${normalise(name)}|${normalise(variant ?? "")}`;

// A note belongs to the items it mentions ("How many pens?" → pen).
// A note that mentions none of the message's items belongs to all of them.
function notesFor(itemName: string, result: ParseResult): string[] {
  const mentions = (note: string, name: string) => note.toLowerCase().includes(normalise(name));
  return result.unclear.filter(
    (note) => mentions(note, itemName) || !result.items.some((item) => mentions(note, item.name)),
  );
}

// `results` holds only the messages Gemma has read so far.
// `fixes` holds quantities the organiser typed, by entry id.
export function aggregate(
  messages: ChatMessage[],
  results: Record<string, ParseResult>,
  fixes: Record<string, number> = {},
): Order {
  let active: Entry[] = [];
  const statuses: Order["messages"] = {};

  // Chat order matters: a cancel only removes what the sender asked for earlier.
  for (const message of messages) {
    const result = results[message.id];
    if (!result) continue; // still reading, or couldn't read

    if (result.intent === "not_an_order") {
      statuses[message.id] = { status: "ignored", notes: [] };
    } else if (result.intent === "add") {
      const entries: Entry[] = result.items.map((item, index) => {
        const id = `${message.id}-${index}`;
        const fixed = id in fixes;
        const quantity = fixed ? fixes[id] : item.quantity;
        const notes = notesFor(item.name, result);
        return {
          id,
          messageId: message.id,
          sender: message.sender,
          name: item.name,
          variant: item.variant,
          quantity,
          source: item.source,
          notes,
          fixed,
          flagged: !fixed && (quantity === null || notes.length > 0),
        };
      });
      active.push(...entries);
      // "mere liye bhi same" gives no items: the organiser has to look.
      const needsCheck = entries.length === 0 || entries.some((entry) => entry.flagged);
      statuses[message.id] = { status: needsCheck ? "needs_check" : "added", notes: result.unclear };
    } else if (result.items.length === 0) {
      // "cancel my order": remove everything this sender asked for so far.
      active = active.filter((entry) => entry.sender !== message.sender);
      statuses[message.id] = { status: "cancelled", notes: result.unclear };
    } else {
      // "cancel the copies": remove this sender's earlier items with the same name.
      const notes = [...result.unclear];
      let needsCheck = false;
      // Each product once, even if Gemma lists it twice ("cancel the 2 copies, 1 copy hi krde").
      const names = [...new Set(result.items.map((item) => normalise(item.name)))];
      for (const name of names) {
        const isMatch = (entry: Entry) => entry.sender === message.sender && normalise(entry.name) === name;
        if (!active.some(isMatch)) {
          notes.push(`Nothing earlier from ${message.sender} matched "${name}", so nothing was removed.`);
          needsCheck = true;
          continue;
        }
        active = active.filter((entry) => !isMatch(entry));
        // A number in a cancel ("1 copy hi krde") may mean they still want some.
        if (result.items.some((item) => normalise(item.name) === name && item.quantity !== null)) {
          notes.push(
            `${message.sender}'s ${name} was removed. The message also mentions a quantity, so check what ${message.sender} still wants.`,
          );
          needsCheck = true;
        }
      }
      statuses[message.id] = { status: needsCheck ? "needs_check" : "cancelled", notes };
    }
  }

  // Group what's left by name + variant, in order of first appearance.
  const groups = new Map<string, OrderGroup>();
  for (const entry of active) {
    const key = groupKey(entry.name, entry.variant);
    let group = groups.get(key);
    if (!group) {
      group = { key, name: entry.name, variant: entry.variant, totalQuantity: 0, entries: [], flagged: false };
      groups.set(key, group);
    }
    group.entries.push(entry);
    group.totalQuantity += entry.quantity ?? 0; // unknown quantities count for nothing until fixed
    group.flagged ||= entry.flagged;
  }

  return { groups: [...groups.values()], messages: statuses };
}
