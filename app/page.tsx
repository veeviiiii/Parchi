"use client";

import { useMemo, useReducer } from "react";
import MessageList, { type ReadState } from "@/components/MessageList";
import OrderSheet from "@/components/OrderSheet";
import PastePanel from "@/components/PastePanel";
import { aggregate } from "@/lib/aggregate";
import { parseChat, type ChatMessage } from "@/lib/parseChat";
import { SAMPLE_CHAT } from "@/lib/sampleChat";
import type { ParseResult } from "@/lib/schema";

type State = {
  text: string;
  messages: ChatMessage[];
  reads: Record<string, ReadState>;
  building: boolean;
  hint: string | null;
};

type Action =
  | { type: "setText"; text: string }
  | { type: "start"; messages: ChatMessage[]; hint: string | null }
  | { type: "read"; id: string; read: ReadState }
  | { type: "finish" };

const START_HINT = "Paste a chat or load the sample to start.";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setText":
      return { ...state, text: action.text };
    case "start":
      return { ...state, messages: action.messages, reads: {}, building: action.messages.length > 0, hint: action.hint };
    case "read":
      return { ...state, reads: { ...state.reads, [action.id]: action.read } };
    case "finish":
      return { ...state, building: false };
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Sends one message to our server. Retries once, after 2 s, on a rate limit or network error.
async function requestParse(text: string, canRetry = true): Promise<ReadState> {
  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (res.ok) return { status: "done", result: data.result };
    if (res.status === 429 && canRetry) {
      await wait(2000);
      return requestParse(text, false);
    }
    return { status: "failed", error: data.error ?? "Couldn't read this message. Retry or add it by hand." };
  } catch {
    if (canRetry) {
      await wait(2000);
      return requestParse(text, false);
    }
    return { status: "failed", error: "No connection. Check your internet, then retry." };
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, {
    text: "",
    messages: [],
    reads: {},
    building: false,
    hint: START_HINT,
  });

  async function readOne(message: ChatMessage) {
    dispatch({ type: "read", id: message.id, read: { status: "reading" } });
    dispatch({ type: "read", id: message.id, read: await requestParse(message.text) });
  }

  async function buildOrder() {
    const messages = parseChat(state.text);
    if (messages.length === 0) {
      const hint = state.text.trim()
        ? 'Couldn\'t find any messages. Each one should look like "Rahul: 2 pens".'
        : START_HINT;
      dispatch({ type: "start", messages, hint });
      return;
    }
    dispatch({ type: "start", messages, hint: null });

    // Two messages at a time, each in its own fresh Gemma request.
    let next = 0;
    async function worker() {
      while (next < messages.length) {
        await readOne(messages[next++]);
      }
    }
    await Promise.all([worker(), worker()]);
    dispatch({ type: "finish" });
  }

  // Everything below is recalculated from the reads: plain code, no AI.
  const order = useMemo(() => {
    const results: Record<string, ParseResult> = {};
    for (const [id, read] of Object.entries(state.reads)) {
      if (read.status === "done") results[id] = read.result;
    }
    return aggregate(state.messages, results);
  }, [state.messages, state.reads]);

  const total = state.messages.length;
  const finished = Object.values(state.reads).filter((r) => r.status !== "reading").length;
  const failed = Object.values(state.reads).filter((r) => r.status === "failed").length;
  let status = state.hint;
  if (state.building) status = `Reading message ${Math.min(finished + 1, total)} of ${total}`;
  else if (total > 0) status = `Read ${total} messages.` + (failed ? ` ${failed} couldn't be read: retry them below.` : "");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Buy Together</h1>
        <p>Paste your group chat. Get one clean order.</p>
      </header>

      <PastePanel
        text={state.text}
        onTextChange={(text) => dispatch({ type: "setText", text })}
        onLoadSample={() => dispatch({ type: "setText", text: SAMPLE_CHAT })}
        onBuild={buildOrder}
        building={state.building}
        status={status}
      />

      {total > 0 && (
        <>
          <MessageList messages={state.messages} reads={state.reads} order={order} onRetry={readOne} />
          <OrderSheet groups={order.groups} building={state.building} />
        </>
      )}
    </main>
  );
}
