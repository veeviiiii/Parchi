// The only file that talks to Gemma. Server-side only: it reads the API key.
import { ApiError, GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import { RETRY_HINT, SYSTEM_PROMPT } from "./prompt";
import { applyGuards, cleanGemmaOutput, type ParseResult } from "./schema";

export const GEMMA_MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";

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

export class MissingKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is missing. Add it to .env.local and restart the dev server.");
  }
}

export class BadReplyError extends Error {
  constructor() {
    super("Gemma's reply wasn't valid JSON, even after a retry.");
  }
}

let client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new MissingKeyError();
    client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        // Give up on any single attempt after 15 s (we saw rare 30 s replies).
        timeout: 15_000,
        // The SDK retries 429, 5xx and network errors. In testing, about 1 call
        // in 7 got a "500 Internal error", so 2 retries (2 s, then ~4 s).
        retryOptions: { attempts: 3, initialDelay: 2 },
      },
    });
  }
  return client;
}

// "Minimal" is the lowest thinking level this model accepts ("low" is rejected).
// Without it, Gemma sometimes repeated items or broke the JSON.
const THINKING = { thinkingLevel: ThinkingLevel.MINIMAL };

// Becomes false if the API rejects system instructions or JSON mode for this
// model. Then the prompt is sent inside the message instead (CLAUDE.md section 8).
let structuredOutput = true;

// One fresh request per message: no chat history, ever.
async function askGemma(message: string, hint?: string): Promise<string> {
  const content = `Message: ${message}` + (hint ? `\n\n${hint}` : "");

  if (structuredOutput) {
    try {
      const response = await getClient().models.generateContent({
        model: GEMMA_MODEL,
        contents: content,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
          thinkingConfig: THINKING,
        },
      });
      return response.text ?? "";
    } catch (err) {
      // 400 = "bad request". Anything else (rate limit, network) is not about the settings.
      if (!(err instanceof ApiError && err.status === 400)) throw err;
    }
  }

  const response = await getClient().models.generateContent({
    model: GEMMA_MODEL,
    contents: `${SYSTEM_PROMPT}\n\n${content}`,
    config: { temperature: 0.2, thinkingConfig: THINKING },
  });
  if (structuredOutput) {
    console.warn("[gemma] Structured output was rejected, so the prompt now goes inside the message.");
    structuredOutput = false;
  }
  return response.text ?? "";
}

// Reads one chat message and returns what the sender wants.
export async function readMessage(message: string): Promise<ParseResult> {
  let result = cleanGemmaOutput(await askGemma(message));
  if (!result) {
    result = cleanGemmaOutput(await askGemma(message, RETRY_HINT));
  }
  if (!result) throw new BadReplyError();
  return applyGuards(result, message);
}
