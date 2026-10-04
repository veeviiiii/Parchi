import { describe, expect, it } from "vitest";
import { cleanJson } from "../schema";
import { applyPostGuards, BLOCKED_REASON, postCheckSchema, type PostCheck } from "./schema";
import { seedPosts } from "./seed";

const body = "Single line copy ₹30, blue gel pen ₹10. Naya stock aa gaya hai";

const check = (overrides: Partial<PostCheck> = {}): PostCheck => ({
  tag: "stock_update",
  summary: "Single line notebooks ₹30 and blue gel pens ₹10 in stock",
  items: [
    { name: "Notebook", variant: "single line", price: 30, unit: null, source: "Single line copy ₹30" },
    { name: "gel pen", variant: "blue", price: 10, unit: null, source: "blue gel pen ₹10" },
  ],
  moderation: { allowed: true, reason: null },
  ...overrides,
});

describe("cleanJson with the Crowdmind schema", () => {
  it("accepts a fenced reply and turns text prices into numbers", () => {
    const raw =
      '```json\n{"tag":"offer","summary":"Deal","items":[{"name":"pen","variant":null,"price":"5","unit":null,"source":"pen ₹5"}],"moderation":{"allowed":true,"reason":null}}\n```';
    expect(cleanJson(raw, postCheckSchema)?.items[0].price).toBe(5);
  });

  it("rejects an unknown tag", () => {
    const raw = '{"tag":"sale","summary":"","items":[],"moderation":{"allowed":true,"reason":null}}';
    expect(cleanJson(raw, postCheckSchema)).toBeNull();
  });
});

describe("applyPostGuards", () => {
  it("keeps items whose quoted words and price are really in the post", () => {
    const result = applyPostGuards(check(), body);
    expect(result.items.map((item) => [item.name, item.price])).toEqual([
      ["notebook", 30],
      ["gel pen", 10],
    ]);
  });

  it("drops an item whose quote isn't in the post", () => {
    const invented = { name: "eraser", variant: null, price: 5, unit: null, source: "eraser ₹5" };
    const result = applyPostGuards(check({ items: [...check().items, invented] }), body);
    expect(result.items.map((item) => item.name)).not.toContain("eraser");
  });

  it("drops an item whose price isn't in its quote", () => {
    const wrongPrice = { name: "notebook", variant: null, price: 35, unit: null, source: "Single line copy ₹30" };
    expect(applyPostGuards(check({ items: [wrongPrice] }), body).items).toEqual([]);
  });

  it("reads prices written with commas", () => {
    const post = "Scientific calculator ₹1,200 only";
    const item = { name: "calculator", variant: "scientific", price: 1200, unit: null, source: "Scientific calculator ₹1,200" };
    expect(applyPostGuards(check({ items: [item] }), post).items).toHaveLength(1);
  });

  it("shortens a long summary to 90 characters", () => {
    const result = applyPostGuards(check({ summary: "a".repeat(150) }), body);
    expect(result.summary).toHaveLength(90);
    expect(result.summary.endsWith("…")).toBe(true);
  });

  it("always gives a blocked post a reason and no items", () => {
    const result = applyPostGuards(check({ moderation: { allowed: false, reason: null } }), body);
    expect(result.moderation).toEqual({ allowed: false, reason: BLOCKED_REASON });
    expect(result.items).toEqual([]);
  });
});

describe("seedPosts", () => {
  it("has two posts in each space, already tagged", () => {
    const posts = seedPosts(0);
    for (const space of ["consumer", "community", "merchant"]) {
      expect(posts.filter((post) => post.space === space)).toHaveLength(2);
    }
  });
});
