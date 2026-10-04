// The only file that talks to Gemma. Server-side only: it reads the API key.
import { ApiError, GoogleGenAI, ThinkingLevel, type Schema } from "@google/genai";

export const GEMMA_MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";

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

type Ask = { system: string; responseSchema: Schema; content: string };

// One fresh request: the system prompt plus one piece of text. No chat history, ever.
export async function askGemma({ system, responseSchema, content }: Ask): Promise<string> {
  if (structuredOutput) {
    try {
      const response = await getClient().models.generateContent({
        model: GEMMA_MODEL,
        contents: content,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseSchema,
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
    contents: `${system}\n\n${content}`,
    config: { temperature: 0.2, thinkingConfig: THINKING },
  });
  if (structuredOutput) {
    console.warn("[gemma] Structured output was rejected, so the prompt now goes inside the message.");
    structuredOutput = false;
  }
  return response.text ?? "";
}
