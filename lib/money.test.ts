import { describe, expect, it } from "vitest";
import type { Entry, OrderGroup } from "./aggregate";
import { formatRupees, grandTotal, lineTotal, parsePrice, parsePrices, whoOwes } from "./money";

const entry = (sender: string, quantity: number | null): Entry => ({
  id: `${sender}-x`,
  messageId: "m1",
  sender,
  name: "",
  variant: null,
  quantity,
  source: "",
  notes: [],
  fixed: false,
  flagged: quantity === null,
});

const group = (key: string, entries: Entry[]): OrderGroup => ({
  key,
  name: key,
  variant: null,
  totalQuantity: entries.reduce((sum, e) => sum + (e.quantity ?? 0), 0),
  entries,
  flagged: entries.some((e) => e.flagged),
});

// The sample chat's order after Gemma reads it.
const groups = [
  group("pen|", [entry("Priya", null)]),
  group("geometry box|", [entry("Aman", 1)]),
  group("gel pen|blue", [entry("Aman", 3)]),
  group("register|", [entry("Karan", 1)]),
  group("notebook|", [entry("Karan", 2)]),
  group("sheet packet|a4", [entry("Neha", 2)]),
];

describe("parsePrice", () => {
  it("reads whole and decimal prices", () => {
    expect(parsePrice("120")).toBe(120);
    expect(parsePrice(" 12.5 ")).toBe(12.5);
    expect(parsePrice("0")).toBe(0);
  });

  it("ignores empty, negative, and non-number text", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("-5")).toBeNull();
  });

  it("keeps only the valid prices", () => {
    expect(parsePrices({ a: "10", b: "", c: "x" })).toEqual({ a: 10 });
  });
});

describe("totals", () => {
  const prices = { "geometry box|": 120, "gel pen|blue": 10, "register|": 60, "notebook|": 25, "sheet packet|a4": 90 };

  it("multiplies total quantity by unit price", () => {
    expect(lineTotal(groups[2], prices)).toBe(30); // 3 gel pens × ₹10
    expect(lineTotal(groups[0], prices)).toBe(0); // no price, unknown quantity
  });

  it("adds up the grand total", () => {
    // 120 + 30 + 60 + 50 + 180
    expect(grandTotal(groups, prices)).toBe(440);
  });

  it("works out who owes what, and adds up to the grand total", () => {
    const owed = whoOwes(groups, prices);
    expect(owed).toEqual([
      { sender: "Priya", amount: 0 }, // quantity unknown until fixed
      { sender: "Aman", amount: 150 },
      { sender: "Karan", amount: 110 },
      { sender: "Neha", amount: 180 },
    ]);
    expect(owed.reduce((sum, o) => sum + o.amount, 0)).toBe(grandTotal(groups, prices));
  });

  it("charges someone for each of their items in a shared row", () => {
    const shared = [group("pen|", [entry("Aman", 2), entry("Neha", 3)])];
    expect(whoOwes(shared, { "pen|": 10 })).toEqual([
      { sender: "Aman", amount: 20 },
      { sender: "Neha", amount: 30 },
    ]);
  });
});

describe("formatRupees", () => {
  it("formats rupees with Indian digit grouping", () => {
    expect(formatRupees(230)).toBe("₹230");
    expect(formatRupees(123456)).toBe("₹1,23,456");
  });

  it("shows paise only when there are some", () => {
    expect(formatRupees(1234.5)).toBe("₹1,234.50");
    expect(formatRupees(3 * 12.1)).toBe("₹36.30"); // not ₹36.300000000000004
  });
});
