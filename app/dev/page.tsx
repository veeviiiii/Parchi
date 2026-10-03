"use client";

// TEMPORARY test page for Phase 1. Delete in Phase 6.
import { useState } from "react";
import { NOT_FOUND_NOTE, type ParseResult } from "@/lib/schema";

type Reply = { result?: ParseResult; error?: string; ms: number };

async function send(text: string): Promise<Reply> {
  const start = performance.now();
  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    return { ...data, ms: Math.round(performance.now() - start) };
  } catch {
    return { error: "Network error", ms: Math.round(performance.now() - start) };
  }
}

// True if the result has an item with this name (and variant / quantity, when given).
function has(r: ParseResult, name: string, variant?: string, quantity?: number | null) {
  return r.items.some(
    (i) =>
      i.name === name &&
      (variant === undefined || (i.variant ?? "").toLowerCase().includes(variant)) &&
      (quantity === undefined || i.quantity === quantity),
  );
}

// The 10 prompt test cases from CLAUDE.md section 9.
const CASES: { text: string; expected: string; pass: (r: ParseResult) => boolean }[] = [
  {
    text: "ek scale aur 2 eraser",
    expected: "add → scale ×1, eraser ×2",
    pass: (r) => r.intent === "add" && r.items.length === 2 && has(r, "scale", undefined, 1) && has(r, "eraser", undefined, 2),
  },
  {
    text: "thanks yaar",
    expected: "not_an_order, no items",
    pass: (r) => r.intent === "not_an_order" && r.items.length === 0,
  },
  {
    text: "a few sticky notes pls",
    expected: "add → sticky note, quantity null, unclear asks how many",
    pass: (r) => r.intent === "add" && has(r, "sticky note", undefined, null) && r.unclear.length > 0,
  },
  {
    text: "mere liye bhi same",
    expected: "add, no items, unclear note about the reference",
    pass: (r) => r.intent === "add" && r.items.length === 0 && r.unclear.length > 0,
  },
  {
    text: "cancel my order",
    expected: "cancel, no items",
    pass: (r) => r.intent === "cancel" && r.items.length === 0,
  },
  {
    text: "3 black pens and 1 red",
    expected: "add → pen (black) ×3, pen (red) ×1",
    pass: (r) => r.intent === "add" && r.items.length === 2 && has(r, "pen", "black", 3) && has(r, "pen", "red", 1),
  },
  {
    text: "bhai 2 copy chahiye single line wali",
    expected: "add → notebook (single line) ×2",
    pass: (r) => r.intent === "add" && r.items.length === 1 && has(r, "notebook", "single line", 2),
  },
  {
    text: "do pencil aur ek sharpener chahiye",
    expected: "add → pencil ×2, sharpener ×1",
    pass: (r) => r.intent === "add" && r.items.length === 2 && has(r, "pencil", undefined, 2) && has(r, "sharpener", undefined, 1),
  },
  {
    text: "kal tak aa jayega kya?",
    expected: "not_an_order, no items",
    pass: (r) => r.intent === "not_an_order" && r.items.length === 0,
  },
  {
    text: "pen nahi chahiye ab",
    expected: "cancel → pen",
    pass: (r) => r.intent === "cancel" && has(r, "pen"),
  },
];

function passes(index: number, reply?: Reply) {
  const r = reply?.result;
  if (!r) return false;
  // Every case also fails if the hallucination guard fired.
  const guardFired = r.unclear.some((note) => note.startsWith(NOT_FOUND_NOTE));
  return CASES[index].pass(r) && !guardFired;
}

export default function DevPage() {
  const [text, setText] = useState("");
  const [single, setSingle] = useState<Reply | null>(null);
  const [replies, setReplies] = useState<(Reply | undefined)[]>([]);
  const [running, setRunning] = useState(false);

  async function runAll() {
    setRunning(true);
    setReplies([]);
    // Two requests at a time, like the real app will do.
    let next = 0;
    async function worker() {
      while (next < CASES.length) {
        const i = next++;
        const reply = await send(CASES[i].text);
        setReplies((prev) => {
          const copy = [...prev];
          copy[i] = reply;
          return copy;
        });
      }
    }
    await Promise.all([worker(), worker()]);
    setRunning(false);
  }

  const done = replies.filter(Boolean).length;
  const passed = CASES.filter((_, i) => passes(i, replies[i])).length;

  return (
    <main className="mx-auto max-w-3xl p-4 font-sans text-sm">
      <h1 className="mb-4 text-xl font-semibold">Gemma test page (temporary)</h1>

      <section className="mb-8">
        <h2 className="mb-2 font-semibold">Send one message</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-2 py-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={async (e) => e.key === "Enter" && setSingle(await send(text))}
            placeholder="Type a chat message, e.g. 2 blue pens"
          />
          <button className="rounded border px-3 py-1" onClick={async () => setSingle(await send(text))}>
            Send
          </button>
        </div>
        {single && (
          <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-2">
            {single.ms} ms{"\n"}
            {JSON.stringify(single.result ?? single.error, null, 2)}
          </pre>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="font-semibold">Prompt test cases (CLAUDE.md section 9)</h2>
          <button className="rounded border px-3 py-1" onClick={runAll} disabled={running}>
            {running ? `Running… ${done} of ${CASES.length}` : "Run all 10"}
          </button>
          {done === CASES.length && !running && (
            <strong id="summary">
              {passed} of {CASES.length} passed
            </strong>
          )}
        </div>
        <ol className="space-y-2">
          {CASES.map((c, i) => {
            const reply = replies[i];
            const status = !reply ? "…" : passes(i, reply) ? "PASS" : "FAIL";
            return (
              <li key={c.text} className="rounded border p-2">
                <div>
                  <strong className={status === "PASS" ? "text-green-700" : status === "FAIL" ? "text-red-700" : ""}>
                    {status}
                  </strong>{" "}
                  <code>{c.text}</code> — expected: {c.expected}
                  {reply && <span className="text-gray-500"> ({reply.ms} ms)</span>}
                </div>
                {reply && (
                  <pre className="mt-1 overflow-x-auto bg-gray-100 p-2 text-xs">
                    {JSON.stringify(reply.result ?? reply.error, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
