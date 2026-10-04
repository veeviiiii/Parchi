// Gemma job 2: check ONE Crowdmind post. Server-side only.
import { Type, type Schema } from "@google/genai";
import { callGemmaJSON } from "../gemmaJson";
import { CROWDMIND_PROMPT } from "./prompt";
import { applyPostGuards, postCheckSchema, TAGS, type PostCheck } from "./schema";

// Same shape as postCheckSchema, written in the format the Gemini API expects.
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    tag: { type: Type.STRING, enum: [...TAGS] },
    summary: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          variant: { type: Type.STRING, nullable: true },
          price: { type: Type.NUMBER },
          unit: { type: Type.STRING, nullable: true },
          source: { type: Type.STRING },
        },
        required: ["name", "variant", "price", "unit", "source"],
        propertyOrdering: ["name", "variant", "price", "unit", "source"],
      },
    },
    moderation: {
      type: Type.OBJECT,
      properties: {
        allowed: { type: Type.BOOLEAN },
        reason: { type: Type.STRING, nullable: true },
      },
      required: ["allowed", "reason"],
      propertyOrdering: ["allowed", "reason"],
    },
  },
  required: ["tag", "summary", "items", "moderation"],
  propertyOrdering: ["tag", "summary", "items", "moderation"],
};

export async function checkPost(body: string): Promise<PostCheck> {
  const check = await callGemmaJSON({
    system: CROWDMIND_PROMPT,
    text: `Post: ${body}`,
    schema: postCheckSchema,
    responseSchema: RESPONSE_SCHEMA,
  });
  return applyPostGuards(check, body);
}
