// The shared Gemma helper (FEATURES_V2 section 5), used by every Gemma job.
// Server-side only. Gemma does the language part; zod checks every answer before we trust it.
import type { Schema } from "@google/genai";
import type { z } from "zod";
import { askGemma, BadReplyError } from "./gemma";
import { cleanJson } from "./schema";

const RETRY_HINT = "Return only valid JSON matching the schema.";

type Job<T> = {
  system: string; // the job's prompt
  text: string; // the one piece of text to read, e.g. "Message: 2 pens"
  schema: z.ZodType<T>; // what a valid answer looks like (checked in code)
  responseSchema: Schema; // the same shape, in the Gemini API's format
};

// Asks Gemma once; if the answer isn't valid JSON of the right shape, asks once more
// with a reminder. Rate limits, 5xx and network errors are retried by the SDK (lib/gemma.ts).
export async function callGemmaJSON<T>({ system, text, schema, responseSchema }: Job<T>): Promise<T> {
  const first = cleanJson(await askGemma({ system, responseSchema, content: text }), schema);
  if (first) return first;
  const second = cleanJson(await askGemma({ system, responseSchema, content: `${text}\n\n${RETRY_HINT}` }), schema);
  if (second) return second;
  throw new BadReplyError();
}
