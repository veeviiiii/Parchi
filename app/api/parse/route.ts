import { ApiError } from "@google/genai";
import { BadReplyError, MissingKeyError, readMessage } from "@/lib/gemma";

// Worst case: 3 attempts of up to 15 s each, plus the waits between them.
export const maxDuration = 60;

const MAX_LENGTH = 500;

// POST { text } -> { result } or { error }
export async function POST(request: Request) {
  let text = "";
  try {
    const body = await request.json();
    if (typeof body?.text === "string") text = body.text.trim().slice(0, MAX_LENGTH);
  } catch {
    // Not JSON: handled by the empty-text check below.
  }
  if (!text) {
    return Response.json({ error: "Send a message as { text }." }, { status: 400 });
  }

  try {
    const result = await readMessage(text);
    return Response.json({ result });
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    if (err instanceof ApiError && err.status === 429) {
      return Response.json({ error: "Gemma is busy (rate limit). Wait a moment and retry." }, { status: 429 });
    }
    if (err instanceof BadReplyError) {
      return Response.json({ error: err.message }, { status: 502 });
    }
    // Log only the error message, never the request or the key.
    console.error("[api/parse]", err instanceof ApiError ? `${err.status} ${err.message}` : err);
    return Response.json({ error: "Couldn't read this message. Retry or add it by hand." }, { status: 502 });
  }
}
