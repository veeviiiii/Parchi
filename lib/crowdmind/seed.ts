// Pre-tagged sample posts (FEATURES_V2 section 9, same as the Supabase SQL). No Gemma calls.
import type { Post } from "./schema";

type Seed = Omit<Post, "id" | "createdAt"> & { minutesAgo: number };

const SEEDS: Seed[] = [
  {
    space: "consumer",
    authorName: "Sharma Stationers",
    authorRole: "merchant",
    body: "Single line copy ₹30, blue gel pen ₹10. Naya stock aa gaya hai",
    tag: "stock_update",
    summary: "Single line notebooks ₹30 and blue gel pens ₹10 in stock",
    items: [
      { name: "notebook", variant: "single line", price: 30, unit: "piece", source: "Single line copy ₹30" },
      { name: "gel pen", variant: "blue", price: 10, unit: "piece", source: "blue gel pen ₹10" },
    ],
    minutesAgo: 12,
  },
  {
    space: "consumer",
    authorName: "Hostel B Block",
    authorRole: "community",
    body: "Friday ko stationery run hai. Apne items Thursday raat 9 baje tak bhejo!",
    tag: "group_order_call",
    summary: "Stationery group order on Friday, send items by Thursday 9 pm",
    items: [],
    minutesAgo: 95,
  },
  {
    space: "community",
    authorName: "CSE 2nd Year",
    authorRole: "community",
    body: "Anyone ordering lab coats in bulk? Combine karte hain, better rate milega",
    tag: "question",
    summary: "Looking to combine bulk lab coat orders",
    items: [],
    minutesAgo: 40,
  },
  {
    space: "community",
    authorName: "Sharma Stationers",
    authorRole: "merchant",
    body: "Group orders above 30 notebooks get 10% off this week",
    tag: "offer",
    summary: "10% off group orders above 30 notebooks",
    items: [],
    minutesAgo: 180,
  },
  {
    space: "merchant",
    authorName: "Hostel B Block",
    authorRole: "community",
    body: "Need 40 single line notebooks + 20 geometry boxes by Monday. Quote bhejo",
    tag: "quote_request",
    summary: "Wants a quote for 40 notebooks and 20 geometry boxes by Monday",
    items: [],
    minutesAgo: 25,
  },
  {
    space: "merchant",
    authorName: "Verma General Store",
    authorRole: "merchant",
    body: "A4 sheet supplier rates badh gaye hain, kisi ke paas sasta wholesaler hai?",
    tag: "question",
    summary: "Asking for a cheaper A4 sheet wholesaler",
    items: [],
    minutesAgo: 300,
  },
];

// Times are relative to when the server started, so the feed always looks recent.
export function seedPosts(now = Date.now()): Post[] {
  return SEEDS.map(({ minutesAgo, ...post }, i) => ({
    ...post,
    id: `seed-${i + 1}`,
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
  }));
}
