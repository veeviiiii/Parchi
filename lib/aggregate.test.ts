import { describe, expect, it } from "vitest";
import { aggregate, groupKey } from "./aggregate";
import { parseChat, type ChatMessage } from "./parseChat";
import { SAMPLE_CHAT } from "./sampleChat";
import type { Item, ParseResult } from "./schema";

const item = (name: string, quantity: number | null, source: string, variant: string | null = null): Item => ({
  name,
  variant,
  quantity,
  source,
});
const add = (items: Item[], unclear: string[] = []): ParseResult => ({ intent: "add", items, unclear });
const cancel = (items: Item[] = []): ParseResult => ({ intent: "cancel", items, unclear: [] });
const chatter: ParseResult = { intent: "not_an_order", items: [], unclear: [] };

// Builds messages m1, m2, ... from [sender, result] pairs.
function chat(...rows: [string, ParseResult][]) {
  const messages: ChatMessage[] = rows.map(([sender], i) => ({ id: `m${i + 1}`, sender, time: "", text: "" }));
  const results = Object.fromEntries(rows.map(([, result], i) => [`m${i + 1}`, result]));
  return { messages, results };
}

describe("aggregate", () => {
  it("produces the expected result for the sample chat (section 17)", () => {
    const messages = parseChat(SAMPLE_CHAT);
    // What Gemma returned for these messages during Phase 1 testing.
    const results: Record<string, ParseResult> = {
      m1: add([item("notebook", 2, "2 copy chahiye single line wali", "single line")]),
      m2: add([item("pen", null, "some pens")], ["How many pens?"]),
      m3: add([item("geometry box", 1, "1 geometry box"), item("gel pen", 3, "3 blue gel pens", "blue")]),
      m4: chatter,
      m5: add([item("register", 1, "ek register"), item("notebook", 2, "2 notebook")]),
      m6: cancel([item("notebook", null, "copies")]),
      m7: add([item("sheet packet", 2, "2 A4 sheet packet", "A4")]),
    };

    const order = aggregate(messages, results);

    const rows = order.groups.map((g) => [g.name, g.variant, g.totalQuantity, g.entries.map((e) => e.sender), g.flagged]);
    expect(rows).toEqual([
      ["pen", null, 0, ["Priya"], true], // Priya: quantity unknown, flagged
      ["geometry box", null, 1, ["Aman"], false],
      ["gel pen", "blue", 3, ["Aman"], false],
      ["register", null, 1, ["Karan"], false],
      ["notebook", null, 2, ["Karan"], false], // Rahul's notebooks are gone, Karan's stay
      ["sheet packet", "A4", 2, ["Neha"], false],
    ]);

    const statuses = Object.fromEntries(Object.entries(order.messages).map(([id, m]) => [id, m.status]));
    expect(statuses).toEqual({
      m1: "added",
      m2: "needs_check",
      m3: "added",
      m4: "ignored", // Sneha: "ok 👍"
      m5: "added",
      m6: "cancelled", // Rahul: "cancel the copies"
      m7: "added",
    });
  });

  it("removes everything from the sender on a cancel with no items", () => {
    const { messages, results } = chat(
      ["Rahul", add([item("pen", 2, "2 pens"), item("eraser", 1, "ek eraser")])],
      ["Priya", add([item("pen", 1, "1 pen")])],
      ["Rahul", cancel()],
    );
    const order = aggregate(messages, results);
    expect(order.groups.map((g) => [g.name, g.totalQuantity])).toEqual([["pen", 1]]);
    expect(order.messages.m3.status).toBe("cancelled");
  });

  it("flags a named cancel that matches nothing, and removes nothing", () => {
    const { messages, results } = chat(
      ["Rahul", add([item("notebook", 2, "2 copy")])],
      ["Rahul", cancel([item("copy", null, "copies")])],
    );
    const order = aggregate(messages, results);
    expect(order.groups[0].totalQuantity).toBe(2);
    expect(order.messages.m2.status).toBe("needs_check");
    expect(order.messages.m2.notes[0]).toContain('matched "copy"');
  });

  it("only cancels earlier requests, not later ones", () => {
    const { messages, results } = chat(
      ["Rahul", cancel([item("pen", null, "pen")])],
      ["Rahul", add([item("pen", 2, "2 pens")])],
    );
    expect(aggregate(messages, results).groups[0].totalQuantity).toBe(2);
  });

  it("groups the same item from different people and ignores case and spaces", () => {
    const { messages, results } = chat(
      ["Aman", add([item("gel pen", 3, "3 blue gel pens", "blue")])],
      ["Neha", add([item("Gel Pen ", 2, "2 blue gel pens", "Blue")])],
      ["Karan", add([item("gel pen", 1, "1 black gel pen", "black")])],
    );
    const order = aggregate(messages, results);
    expect(order.groups.map((g) => [g.key, g.totalQuantity, g.entries.length])).toEqual([
      ["gel pen|blue", 5, 2],
      ["gel pen|black", 1, 1],
    ]);
    expect(groupKey(" Gel  Pen", "BLUE")).toBe("gel pen|blue");
  });

  it("uses a quantity the organiser fixed, and clears the flag", () => {
    const { messages, results } = chat(["Priya", add([item("pen", null, "some pens")], ["How many pens?"])]);
    const before = aggregate(messages, results);
    expect(before.groups[0]).toMatchObject({ totalQuantity: 0, flagged: true });

    const after = aggregate(messages, results, { "m1-0": 4 });
    expect(after.groups[0]).toMatchObject({ totalQuantity: 4, flagged: false });
    expect(after.groups[0].entries[0]).toMatchObject({ quantity: 4, fixed: true });
    expect(after.messages.m1.status).toBe("added");
  });

  it("attaches a note only to the item it mentions", () => {
    const { messages, results } = chat([
      "Aman",
      add([item("geometry box", 1, "1 geometry box"), item("pen", null, "some pens")], ["How many pens?"]),
    ]);
    const order = aggregate(messages, results);
    expect(order.groups.map((g) => [g.name, g.flagged])).toEqual([
      ["geometry box", false],
      ["pen", true],
    ]);
  });

  it("marks a reference to someone else's order as needing a check", () => {
    const { messages, results } = chat(["Neha", add([], ["Same as someone else's order — whose?"])]);
    const order = aggregate(messages, results);
    expect(order.groups).toEqual([]);
    expect(order.messages.m1.status).toBe("needs_check");
  });

  it("skips messages that haven't been read yet", () => {
    const messages: ChatMessage[] = [{ id: "m1", sender: "Rahul", time: "", text: "2 pens" }];
    expect(aggregate(messages, {})).toEqual({ groups: [], messages: {} });
  });
});
