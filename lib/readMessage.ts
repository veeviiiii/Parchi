// Gemma job 1: read ONE chat message and say what the sender wants (CLAUDE.md section 7).
// Server-side only.
import { Type, type Schema } from "@google/genai";
import { callGemmaJSON } from "./gemmaJson";
import { SYSTEM_PROMPT } from "./prompt";
import { applyGuards, parseResultSchema, type ParseResult } from "./schema";

// Same shape as lib/schema.ts, written in the format the Gemini API expects.
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ["add", "cancel", "not_an_order"] },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          variant: { type: Type.STRING, nullable: true },
          quantity: { type: Type.INTEGER, nullable: true },
          source: { type: Type.STRING },
        },
        required: ["name", "variant", "quantity", "source"],
        propertyOrdering: ["name", "variant", "quantity", "source"],
      },
    },
    unclear: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["intent", "items", "unclear"],
  propertyOrdering: ["intent", "items", "unclear"],
};

export async function readMessage(message: string): Promise<ParseResult> {
  const result = await callGemmaJSON({
    system: SYSTEM_PROMPT,
    text: `Message: ${message}`,
    schema: parseResultSchema,
    responseSchema: RESPONSE_SCHEMA,
  });
  return applyGuards(result, message);
}
