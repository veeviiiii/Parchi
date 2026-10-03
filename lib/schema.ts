import { z } from "zod";

// The shape Gemma must return for ONE message (CLAUDE.md section 7).
export const itemSchema = z.object({
  name: z.string().trim().min(1),
  variant: z.string().nullable(),
  quantity: z.number().int().positive().nullable(),
  source: z.string(),
});

export const parseResultSchema = z.object({
  intent: z.enum(["add", "cancel", "not_an_order"]),
  items: z.array(itemSchema),
  unclear: z.array(z.string()),
});

export type Item = z.infer<typeof itemSchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;

export const NOT_FOUND_NOTE = "Couldn't find this in the message — please check";

// Turns Gemma's raw text into a validated result.
// Returns null if the text isn't valid JSON or doesn't match the schema.
export function cleanGemmaOutput(raw: string): ParseResult | null {
  // 1. Strip ```json fences and trim.
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  // 2. JSON.parse
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  // 3. Turn quantities like "2" into 2.
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    for (const item of (data as { items: Record<string, unknown>[] }).items) {
      if (item && typeof item.quantity === "string" && /^\d+$/.test(item.quantity.trim())) {
        item.quantity = Number(item.quantity.trim());
      }
    }
  }

  // 4. Validate with zod.
  const parsed = parseResultSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

// Checks done in plain code after Gemma answers (CLAUDE.md section 8).
export function applyGuards(result: ParseResult, message: string): ParseResult {
  // Chatter: Gemma sometimes copies the message into `unclear`. Drop it.
  if (result.intent === "not_an_order") {
    return { intent: "not_an_order", items: [], unclear: [] };
  }

  const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

  // Gemma sometimes repeats an item word for word. Keep the first copy only.
  const seen = new Set<string>();
  const items = result.items
    .map((item) => ({ ...item, name: normalise(item.name) }))
    .filter((item) => {
      const key = JSON.stringify([item.name, item.variant, item.quantity, normalise(item.source)]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Hallucination guard: every item's `source` must really be in the message.
  const haystack = normalise(message);
  const unclear = [...result.unclear];
  for (const item of items) {
    const source = normalise(item.source);
    if (!source || !haystack.includes(source)) {
      unclear.push(`${NOT_FOUND_NOTE} ("${item.name}")`);
    }
  }

  return { intent: result.intent, items, unclear };
}
