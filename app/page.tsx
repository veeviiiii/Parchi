"use client";

import { useMemo, useReducer } from "react";
import MessageList, { type ReadState } from "@/components/MessageList";
import OrderSheet from "@/components/OrderSheet";
import PastePanel from "@/components/PastePanel";
import Summary from "@/components/Summary";
import { aggregate } from "@/lib/aggregate";
import { parsePrices } from "@/lib/money";
import { parseChat, type ChatMessage } from "@/lib/parseChat";
import { SAMPLE_CHAT } from "@/lib/sampleChat";
import type { ParseResult } from "@/lib/schema";

type State = {
  text: string;
  messages: ChatMessage[];
  reads: Record<string, ReadState>;
  building: boolean;
  hint: string | null;
  fixes: Record<string, number>; // quantities the organiser typed, by entry id
  priceTexts: Record<string, string>; // price boxes, by order-sheet row
};

type Action =
  | { type: "setText"; text: string }
  | { type: "start"; messages: ChatMessage[]; hint: string | null }
  | { type: "read"; id: string; read: ReadState }
  | { type: "finish" }
  | { type: "fix"; entryId: string; quantity: number | null }
  | { type: "price"; key: string; text: string };

// Drops fixes for one message's entries (ids look like "m3-0", "m3-1").
function withoutFixesFor(fixes: Record<string, number>, messageId: string) {
  return Object.fromEntries(Object.entries(fixes).filter(([id]) => !id.startsWith(`${messageId}-`)));
}

const START_HINT = "Paste a chat or load the sample to start.";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setText":
      return { ...state, text: action.text };
    case "start":
      // New messages get new ids, so old fixes no longer apply. Prices stay: they're per item.
      return {
        ...state,
        messages: action.messages,
        reads: {},
        building: action.messages.length > 0,
        hint: action.hint,
        fixes: {},
      };
    case "read": {
      // Re-reading a message (Retry) may give different items, so forget its fixes.
      const fixes = action.read.status === "reading" ? withoutFixesFor(state.fixes, action.id) : state.fixes;
      return { ...state, reads: { ...state.reads, [action.id]: action.read }, fixes };
    }
    case "finish":
      return { ...state, building: false };
    case "fix": {
      const fixes = { ...state.fixes };
      if (action.quantity === null) delete fixes[action.entryId];
      else fixes[action.entryId] = action.quantity;
      return { ...state, fixes };
    }
    case "price":
      return { ...state, priceTexts: { ...state.priceTexts, [action.key]: action.text } };
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
    fixes: {},
    priceTexts: {},
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
    return aggregate(state.messages, results, state.fixes);
  }, [state.messages, state.reads, state.fixes]);
  const prices = useMemo(() => parsePrices(state.priceTexts), [state.priceTexts]);

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
          <OrderSheet
            groups={order.groups}
            building={state.building}
            prices={prices}
            priceTexts={state.priceTexts}
            onPriceChange={(key, text) => dispatch({ type: "price", key, text })}
            onFix={(entryId, quantity) => dispatch({ type: "fix", entryId, quantity })}
          />
          {order.groups.length > 0 && <Summary groups={order.groups} prices={prices} />}
        </>
      )}
    </main>
  );
}
