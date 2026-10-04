// Crowdmind (FEATURES_V2 section 9): what Gemma returns for ONE post, and what a saved post looks like.
import { z } from "zod";
import type { Role } from "../roles";
import { numberFromText } from "../schema";

export const TAGS = [
  "offer",
  "stock_update",
  "group_order_call",
  "quote_request",
  "question",
  "review",
  "announcement",
  "other",
] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABEL: Record<Tag, string> = {
  offer: "Offer",
  stock_update: "Stock update",
  group_order_call: "Group order call",
  quote_request: "Quote request",
  question: "Question",
  review: "Review",
  announcement: "Announcement",
  other: "Other",
};

const postItemSchema = z.object({
  name: z.string().trim().min(1),
  variant: z.string().nullable(),
  price: z.preprocess(numberFromText, z.number().nonnegative()), // rupees, as written in the post
  unit: z.string().nullable(),
  source: z.string(),
});

export const postCheckSchema = z.object({
  tag: z.enum(TAGS),
  // The spec says 90 characters. We accept up to 160 and shorten in code,
  // so a slightly long summary doesn't cost a whole Gemma retry.
  summary: z.string().max(160),
  items: z.array(postItemSchema),
  moderation: z.object({ allowed: z.boolean(), reason: z.string().nullable() }),
});

export type PostItem = z.infer<typeof postItemSchema>;
export type PostCheck = z.infer<typeof postCheckSchema>;

export type Post = {
  id: string;
  createdAt: string; // ISO time
  space: Role; // whose space it was posted into
  authorName: string;
  authorRole: Role;
  body: string;
  tag: Tag;
  summary: string;
  items: PostItem[];
};

export const SUMMARY_MAX = 90;
export const BLOCKED_REASON = "This post can't be published on Parchi.";

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Checks done in plain code after Gemma answers. Gemma never invents items or prices:
// an item is kept only if its quoted words are really in the post and contain its price.
export function applyPostGuards(check: PostCheck, body: string): PostCheck {
  const post = normalise(body);
  const items = check.items
    .map((item) => ({ ...item, name: normalise(item.name) }))
    .filter((item) => {
      const source = normalise(item.source);
      return source !== "" && post.includes(source) && source.replace(/,/g, "").includes(String(item.price));
    });

  let summary = check.summary.replace(/\s+/g, " ").trim();
  if (summary.length > SUMMARY_MAX) summary = summary.slice(0, SUMMARY_MAX - 1).trimEnd() + "…";

  const { allowed } = check.moderation;
  const reason = allowed ? null : check.moderation.reason?.trim() || BLOCKED_REASON;
  return { tag: check.tag, summary, items: allowed ? items : [], moderation: { allowed, reason } };
}
