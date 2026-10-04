"use client";

import { useEffect, useMemo, useReducer } from "react";
import AppHeader from "@/components/AppHeader";
import MessageList, { type ReadState } from "@/components/MessageList";
import RoleGate from "@/components/RoleGate";
import OrderSheet from "@/components/OrderSheet";
import PastePanel from "@/components/PastePanel";
import Summary from "@/components/Summary";
import { aggregate } from "@/lib/aggregate";
import { parsePrices } from "@/lib/money";
import { parseChat, type ChatMessage } from "@/lib/parseChat";
import type { Profile } from "@/lib/profile";
import { ORDER_LABEL } from "@/lib/roles";
import { SAMPLE_CHAT } from "@/lib/sampleChat";
import type { ParseResult } from "@/lib/schema";

// What gets saved in the browser, so a refresh doesn't lose the order.
type Saved = {
  text: string;
  messages: ChatMessage[];
  reads: Record<string, ReadState>;
  fixes: Record<string, number>; // quantities the organiser typed, by entry id
  priceTexts: Record<string, string>; // price boxes, by order-sheet row
};

type State = Saved & {
  building: boolean;
  hint: string | null;
  restored: boolean; // true once we've checked the browser for saved work
};

type Action =
  | { type: "restore"; saved: Saved | null }
  | { type: "reset" }
  | { type: "setText"; text: string }
  | { type: "start"; messages: ChatMessage[]; hint: string | null }
  | { type: "read"; id: string; read: ReadState }
  | { type: "finish" }
  | { type: "fix"; entryId: string; quantity: number | null }
  | { type: "price"; key: string; text: string };

const START_HINT = "Paste a chat or load the sample to start.";
const SAVE_KEY = "parchi.order";
// Each message is one Gemma request (~1 per second), so very long exports are capped.
const MAX_MESSAGES = 60;

const EMPTY: State = {
  text: "",
  messages: [],
  reads: {},
  fixes: {},
  priceTexts: {},
  building: false,
  hint: START_HINT,
  restored: false,
};

// Drops fixes for one message's entries (ids look like "m3-0", "m3-1").
function withoutFixesFor(fixes: Record<string, number>, messageId: string) {
  return Object.fromEntries(Object.entries(fixes).filter(([id]) => !id.startsWith(`${messageId}-`)));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "restore": {
      if (!action.saved) return { ...state, restored: true };
      // A read that was in progress when the page closed has to be retried.
      const reads: Record<string, ReadState> = {};
      for (const [id, read] of Object.entries(action.saved.reads)) {
        reads[id] = read.status === "reading" ? { status: "failed", error: "Interrupted. Retry." } : read;
      }
      return { ...state, ...action.saved, reads, hint: action.saved.messages.length ? null : START_HINT, restored: true };
    }
    case "reset":
      return { ...EMPTY, restored: true };
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

// Reads saved work from the browser. Anything unexpected counts as "nothing saved".
function loadSaved(): Saved | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null");
    if (!saved || !Array.isArray(saved.messages)) return null;
    return {
      text: String(saved.text ?? ""),
      messages: saved.messages,
      reads: saved.reads ?? {},
      fixes: saved.fixes ?? {},
      priceTexts: saved.priceTexts ?? {},
    };
  } catch {
    return null;
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

// /order needs a role: no profile → back to the landing page.
export default function OrderPage() {
  return (
    <RoleGate>
      {(profile) => (
        <>
          <AppHeader profile={profile} />
          <OrderBuilder profile={profile} />
        </>
      )}
    </RoleGate>
  );
}

function OrderBuilder({ profile }: { profile: Profile }) {
  const [state, dispatch] = useReducer(reducer, EMPTY);

  // On first load, bring back any saved work. (localStorage only exists in the browser.)
  useEffect(() => {
    dispatch({ type: "restore", saved: loadSaved() });
  }, []);

  // Save after every change, once the restore above has happened.
  const { restored, text, messages, reads, fixes, priceTexts } = state;
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ text, messages, reads, fixes, priceTexts }));
    } catch {
      // Private browsing or storage full: the app still works, it just won't remember.
    }
  }, [restored, text, messages, reads, fixes, priceTexts]);

  async function readOne(message: ChatMessage) {
    dispatch({ type: "read", id: message.id, read: { status: "reading" } });
    dispatch({ type: "read", id: message.id, read: await requestParse(message.text) });
  }

  async function buildOrder() {
    let messages = parseChat(state.text);
    if (messages.length === 0) {
      const hint = state.text.trim()
        ? 'Couldn\'t find any messages. Each one should look like "Rahul: 2 pens".'
        : START_HINT;
      dispatch({ type: "start", messages, hint });
      return;
    }
    let hint: string | null = null;
    if (messages.length > MAX_MESSAGES) {
      hint = `This chat has ${messages.length} messages, so only the latest ${MAX_MESSAGES} are read. To read others, paste just that part of the chat.`;
      messages = messages.slice(-MAX_MESSAGES);
    }
    dispatch({ type: "start", messages, hint });

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

  function startOver() {
    if (window.confirm("Clear the chat, the order, and all prices?")) dispatch({ type: "reset" });
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
  let progress: string | null = null;
  if (state.building) progress = `Reading message ${Math.min(finished + 1, total)} of ${total}.`;
  else if (total > 0) progress = `Read ${total} messages.` + (failed ? ` ${failed} couldn't be read: retry them below.` : "");
  const status = [progress, state.hint].filter(Boolean).join(" ") || null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{ORDER_LABEL[profile.role]}</h1>
          <p className="text-lg">Paste a chat. Get one clean order.</p>
        </div>
        {(state.text || total > 0) && !state.building && (
          <button type="button" onClick={startOver} className="min-h-11 shrink-0 underline">
            Start over
          </button>
        )}
      </header>

      {/* Phone: one column. Laptop: the chat on the left, the notebook on the right. */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <PastePanel
            text={state.text}
            onTextChange={(text) => dispatch({ type: "setText", text })}
            onLoadSample={() => dispatch({ type: "setText", text: SAMPLE_CHAT })}
            onBuild={buildOrder}
            building={state.building}
            status={status}
          />
          {total > 0 && (
            <MessageList messages={state.messages} reads={state.reads} order={order} onRetry={readOne} />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <OrderSheet
            groups={order.groups}
            building={state.building}
            prices={prices}
            priceTexts={state.priceTexts}
            onPriceChange={(key, text) => dispatch({ type: "price", key, text })}
            onFix={(entryId, quantity) => dispatch({ type: "fix", entryId, quantity })}
          />
          {order.groups.length > 0 && <Summary groups={order.groups} prices={prices} profile={profile} />}
        </div>
      </div>
    </main>
  );
}
