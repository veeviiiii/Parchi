import { describe, expect, it } from "vitest";
import type { Entry, OrderGroup } from "./aggregate";
import { amountInWords, billNumber, billProblem, billText, buildBill, formatAmount } from "./bill";

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

const group = (name: string, variant: string | null, entries: Entry[]): OrderGroup => ({
  key: `${name}|${variant ?? ""}`,
  name,
  variant,
  totalQuantity: entries.reduce((sum, e) => sum + (e.quantity ?? 0), 0),
  entries,
  flagged: entries.some((e) => e.flagged),
});

const groups = [
  group("notebook", "single line", [entry("Karan", 2), entry("Aman", 1)]),
  group("gel pen", "blue", [entry("Aman", 3)]),
  group("register", null, [entry("Karan", 1)]),
];
const prices = { "notebook|single line": 33.33, "gel pen|blue": 10.1, "register|": 45 };
const fixedNow = new Date("2026-10-03T20:00:00Z"); // 4 Oct 2026, 1:30 am in India

describe("amountInWords", () => {
  it("uses the Indian number system", () => {
    expect(amountInWords(0)).toBe("Rupees Zero Only");
    expect(amountInWords(1)).toBe("Rupees One Only");
    expect(amountInWords(15)).toBe("Rupees Fifteen Only");
    expect(amountInWords(100)).toBe("Rupees One Hundred Only");
    expect(amountInWords(1234)).toBe("Rupees One Thousand Two Hundred Thirty-Four Only");
    expect(amountInWords(100000)).toBe("Rupees One Lakh Only");
    expect(amountInWords(1234567.89)).toBe(
      "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Eighty-Nine Paise Only",
    );
  });

  it("handles crores", () => {
    expect(amountInWords(120000000)).toBe("Rupees Twelve Crore Only");
  });
});

describe("billNumber", () => {
  it("is PCH-YYMMDD-XXXX with the date in India", () => {
    expect(billNumber(fixedNow, () => 0.5)).toBe("PCH-261004-IIII");
    expect(billNumber(new Date())).toMatch(/^PCH-\d{6}-[0-9A-Z]{4}$/);
  });
});

describe("billProblem", () => {
  it("asks for missing quantities and prices", () => {
    const withGaps = [...groups, group("pen", null, [entry("Priya", null)]), group("scale", null, [entry("Neha", 1)])];
    expect(billProblem(withGaps, prices)).toBe("Add 1 missing quantity and 1 missing price first.");
    expect(billProblem(groups, {})).toBe("Add 3 missing prices first.");
    expect(billProblem(groups, prices)).toBeNull();
  });

  it("checks only one customer's rows for a merchant bill", () => {
    const withGaps = [...groups, group("pen", null, [entry("Priya", null)])];
    expect(billProblem(withGaps, prices, "Aman")).toBeNull();
    expect(billProblem(withGaps, prices, "Priya")).toBe("Add 1 missing quantity first.");
  });

  it("needs at least one row with a quantity", () => {
    expect(billProblem([group("pen", null, [entry("Priya", 0)])], {})).toBe("Nothing to bill yet.");
  });
});

describe("buildBill", () => {
  it("totals the lines in whole paise", () => {
    const bill = buildBill({ groups, prices, role: "consumer", from: " ", to: "Vedant", now: fixedNow });
    expect(bill.lines).toEqual([
      { item: "Notebook (single line)", quantity: 3, ratePaise: 3333, amountPaise: 9999 },
      { item: "Gel pen (blue)", quantity: 3, ratePaise: 1010, amountPaise: 3030 },
      { item: "Register", quantity: 1, ratePaise: 4500, amountPaise: 4500 },
    ]);
    expect(bill.totalPaise).toBe(17529);
    expect(bill.from).toBe("");
    expect(bill.split).toBeNull();
  });

  it("gives a community split that adds up exactly to the total", () => {
    const bill = buildBill({ groups, prices, role: "community", from: "", to: "Hostel B", now: fixedNow });
    expect(bill.split).toEqual([
      { name: "Karan", amountPaise: 6666 + 4500 },
      { name: "Aman", amountPaise: 3333 + 3030 },
    ]);
    const shares = bill.split!.reduce((sum, share) => sum + share.amountPaise, 0);
    expect(shares).toBe(bill.totalPaise);
  });

  it("bills one customer for a merchant", () => {
    const bill = buildBill({ groups, prices, role: "merchant", from: "Sharma", to: "Aman", sender: "Aman" });
    expect(bill.lines.map((line) => [line.item, line.quantity])).toEqual([
      ["Notebook (single line)", 1],
      ["Gel pen (blue)", 3],
    ]);
    expect(bill.totalPaise).toBe(3333 + 3030);
  });

  it("leaves out rows the organiser set to 0", () => {
    const withZero = [...groups, group("pen", null, [entry("Priya", 0)])];
    const bill = buildBill({ groups: withZero, prices, role: "consumer", from: "", to: "Vedant" });
    expect(bill.lines).toHaveLength(3);
  });
});

describe("billText", () => {
  it("formats the bill for WhatsApp", () => {
    const bill = buildBill({ groups, prices, role: "community", from: "Sharma Stationers", to: "Hostel B", now: fixedNow, random: () => 0 });
    const text = billText(bill);
    expect(text).toContain("Parchi bill PCH-261004-0000");
    expect(text).toContain("From: Sharma Stationers");
    expect(text).toContain("1. Notebook (single line) × 3 @ ₹33.33 = ₹99.99");
    expect(text).toContain("Total: ₹175.29");
    expect(text).toContain("Rupees One Hundred Seventy-Five and Twenty-Nine Paise Only");
    expect(text).toContain("Karan: ₹111.66");
    expect(text).toContain("This is not a GST tax invoice.");
  });
});

describe("formatAmount", () => {
  it("shows Indian digit grouping with paise", () => {
    expect(formatAmount(123456789)).toBe("12,34,567.89");
  });
});
