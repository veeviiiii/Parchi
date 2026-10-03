import { describe, expect, it } from "vitest";
import { NOT_FOUND_NOTE, applyGuards, cleanGemmaOutput, type ParseResult } from "./schema";

const pen = { name: "pen", variant: null, quantity: 2, source: "2 pens" };

describe("cleanGemmaOutput", () => {
  it("strips ```json fences", () => {
    const raw = '```json\n{"intent":"add","items":[],"unclear":[]}\n```';
    expect(cleanGemmaOutput(raw)).toEqual({ intent: "add", items: [], unclear: [] });
  });

  it("turns a numeric-string quantity into a number", () => {
    const raw = JSON.stringify({ intent: "add", items: [{ ...pen, quantity: "2" }], unclear: [] });
    expect(cleanGemmaOutput(raw)?.items[0].quantity).toBe(2);
  });

  it("returns null for text that isn't JSON", () => {
    expect(cleanGemmaOutput("Sure! Here is the JSON:")).toBeNull();
  });

  it("returns null when the shape is wrong", () => {
    expect(cleanGemmaOutput('{"intent":"buy","items":[],"unclear":[]}')).toBeNull();
    expect(cleanGemmaOutput(JSON.stringify({ intent: "add", items: [{ ...pen, quantity: 0 }], unclear: [] }))).toBeNull();
  });
});

describe("applyGuards", () => {
  it("drops notes and items on chatter", () => {
    const result: ParseResult = { intent: "not_an_order", items: [], unclear: ["kal tak aa jayega kya?"] };
    expect(applyGuards(result, "kal tak aa jayega kya?")).toEqual({ intent: "not_an_order", items: [], unclear: [] });
  });

  it("flags an item whose source isn't in the message", () => {
    const result: ParseResult = { intent: "add", items: [{ ...pen, source: "3 markers" }], unclear: [] };
    const guarded = applyGuards(result, "2 pens please");
    expect(guarded.items).toHaveLength(1);
    expect(guarded.unclear[0]).toContain(NOT_FOUND_NOTE);
  });

  it("matches the source ignoring case and extra spaces", () => {
    const result: ParseResult = { intent: "add", items: [{ ...pen, source: "2  PENS" }], unclear: [] };
    expect(applyGuards(result, "bhai 2 pens chahiye").unclear).toEqual([]);
  });

  it("removes exact duplicate items and lowercases names", () => {
    const result: ParseResult = { intent: "add", items: [{ ...pen, name: "Pen" }, pen, pen], unclear: [] };
    expect(applyGuards(result, "2 pens").items).toEqual([pen]);
  });
});
