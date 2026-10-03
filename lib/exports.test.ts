import { describe, expect, it } from "vitest";
import { aggregate } from "./aggregate";
import { itemLabel, orderCsv, shopText, whoOwesText } from "./exports";
import { parseChat } from "./parseChat";
import type { ParseResult } from "./schema";

// The section 12 example order, built the same way the app builds it.
const messages = parseChat(
  [
    "Rahul: 2 copy chahiye single line wali",
    "Aman: 3 blue gel pens aur 1 geometry box",
    "Karan: 2 A4 sheet packet",
    "Priya: some pens",
  ].join("\n"),
);
const results: Record<string, ParseResult> = {
  m1: { intent: "add", items: [{ name: "notebook", variant: "single line", quantity: 2, source: "2 copy" }], unclear: [] },
  m2: {
    intent: "add",
    items: [
      { name: "gel pen", variant: "blue", quantity: 3, source: "3 blue gel pens" },
      { name: "geometry box", variant: null, quantity: 1, source: "1 geometry box" },
    ],
    unclear: [],
  },
  m3: { intent: "add", items: [{ name: "a4 sheet packet", variant: null, quantity: 2, source: "2 A4 sheet packet" }], unclear: [] },
  m4: { intent: "add", items: [{ name: "pen", variant: null, quantity: null, source: "some pens" }], unclear: ["How many pens?"] },
};
const { groups } = aggregate(messages, results);

describe("itemLabel", () => {
  it("capitalises the name and adds the variant in brackets", () => {
    expect(itemLabel("gel pen", "blue")).toBe("Gel pen (blue)");
    expect(itemLabel("a4 sheet packet", null)).toBe("A4 sheet packet");
  });
});

describe("shopText", () => {
  it("matches the section 12 format and leaves out unknown quantities", () => {
    expect(shopText(groups)).toBe(
      [
        "Group order — 4 items",
        "• Notebook (single line) × 2",
        "• Gel pen (blue) × 3",
        "• Geometry box × 1",
        "• A4 sheet packet × 2",
      ].join("\n"),
    );
  });

  it("includes a row once its quantity is fixed", () => {
    const fixed = aggregate(messages, results, { "m4-0": 5 }).groups;
    expect(shopText(fixed)).toContain("Group order — 5 items");
    expect(shopText(fixed)).toContain("• Pen × 5");
  });

  it("says 1 item, not 1 items", () => {
    expect(shopText(groups.slice(0, 1))).toBe("Group order — 1 item\n• Notebook (single line) × 2");
  });
});

describe("whoOwesText", () => {
  it("matches the section 12 format", () => {
    const prices = { "notebook|single line": 40, "gel pen|blue": 10, "geometry box|": 200, "a4 sheet packet|": 55 };
    expect(whoOwesText(groups, prices)).toBe(
      ["Who owes what", "Rahul: ₹80", "Aman: ₹230", "Karan: ₹110", "Priya: ₹0"].join("\n"),
    );
  });
});

describe("orderCsv", () => {
  it("has one line per person per item, with blanks for unknowns", () => {
    const lines = orderCsv(groups, { "gel pen|blue": 12.1 }).split("\n");
    expect(lines[0]).toBe("Item,Variant,Person,Quantity,Unit price,Amount");
    expect(lines).toContain("Gel pen,blue,Aman,3,12.1,36.3");
    expect(lines).toContain("Pen,,Priya,,,");
  });

  it("quotes values that contain commas or quotes", () => {
    const tricky = aggregate(parseChat('Neha: x'), {
      m1: { intent: "add", items: [{ name: "pen", variant: 'blue, "fine"', quantity: 1, source: "x" }], unclear: [] },
    }).groups;
    expect(orderCsv(tricky, {}).split("\n")[1]).toBe('Pen,"blue, ""fine""",Neha,1,,');
  });
});
