"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { aggregate, type OrderGroup } from "@/lib/aggregate";
import { billProblem, buildBill } from "@/lib/bill";
import { saveBill } from "@/lib/billStore";
import { copyText, downloadText } from "@/lib/browser";
import { itemLabel, orderCsv, shopText, whoOwesText } from "@/lib/exports";
import { formatRupees, grandTotal, lineTotal, parsePrices, whoOwes } from "@/lib/money";
import { parseChat, type ChatMessage } from "@/lib/parseChat";
import type { Profile } from "@/lib/profile";
import { SAMPLE_CHAT } from "@/lib/sampleChat";
import type { ParseResult } from "@/lib/schema";

// Where each message is in its trip to Gemma and back.
export type ReadState =
  | { status: "reading" }
  | { status: "done"; result: ParseResult }
  | { status: "failed"; error: string };

// What gets saved in the browser, so a refresh doesn't lose the order.
type Saved = {
  text: string;
  messages: ChatMessage[];
  reads: Record<string, ReadState>;
  fixes: Record<string, number>; // quantities the organiser typed, by entry id
  priceTexts: Record<string, string>; // price boxes, by order row
};

type State = Saved & { building: boolean; hint: string | null; restored: boolean };

type Action =
  | { type: "restore"; saved: Saved | null }
  | { type: "reset" }
  | { type: "setText"; text: string }
  | { type: "start"; messages: ChatMessage[]; hint: string | null }
  | { type: "read"; id: string; read: ReadState }
  | { type: "finish" }
  | { type: "fix"; entryId: string; quantity: number | null }
  | { type: "price"; key: string; text: string };

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
  hint: null,
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
      return { ...state, ...action.saved, reads, restored: true };
    }
    case "reset":
      return { ...EMPTY, restored: true };
    case "setText":
      return { ...state, text: action.text };
    case "start":
      // New messages get new ids, so old fixes no longer apply. Prices stay: they're per item.
      return { ...state, messages: action.messages, reads: {}, building: action.messages.length > 0, hint: action.hint, fixes: {} };
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

// Gemma's answer in words, e.g. "Notebook (single line) × 2" or "cancel: Notebook".
function describe(result: ParseResult): string {
  if (result.intent === "not_an_order") return "not an order";
  if (result.items.length === 0) return result.intent === "cancel" ? "cancel everything" : "no items";
  const items = result.items
    .map((item) => {
      const label = itemLabel(item.name, item.variant);
      if (item.quantity !== null) return `${label} × ${item.quantity}`;
      return result.intent === "add" ? `${label} × ?` : label;
    })
    .join(", ");
  return result.intent === "cancel" ? `cancel: ${items}` : items;
}

// Status pills from the design: [label, class].
const PILL: Record<string, [string, string]> = {
  added: ["✓ Added", "s-a"],
  cancelled: ["✕ Cancelled", "s-c"],
  ignored: ["– Ignored", "s-i"],
  needs_check: ["? Needs a check", "s-n"],
  reading: ["Reading…", "s-u"],
  failed: ["⟳ Couldn’t read", "s-u"],
  waiting: ["Waiting", "s-u"],
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The "Build a Parchi" page: paste a chat, Gemma reads each message, code builds the order.
export default function Builder({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, EMPTY);
  const [copied, setCopied] = useState<string | null>(null); // which copy button says "Copied!"
  const [manualCopy, setManualCopy] = useState<string | null>(null); // shown if copying is blocked
  const [note, setNote] = useState<string | null>(null);
  const [shopName, setShopName] = useState(""); // optional "From" on a consumer or community bill
  const fileInput = useRef<HTMLInputElement>(null);

  // On first load, bring back any saved work. (localStorage only exists in the browser.)
  useEffect(() => {
    dispatch({ type: "restore", saved: loadSaved() });
    // The landing page's "Try a sample chat" opens /build?sample=1.
    if (new URLSearchParams(window.location.search).get("sample") === "1") {
      dispatch({ type: "setText", text: SAMPLE_CHAT });
      window.history.replaceState(null, "", "/build");
    }
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
    let chat = parseChat(state.text);
    if (chat.length === 0) {
      const hint = state.text.trim()
        ? 'Couldn\'t find any messages. Each one should look like "Rahul: 2 pens".'
        : "Paste a chat first, or load the sample.";
      dispatch({ type: "start", messages: chat, hint });
      return;
    }
    let hint: string | null = null;
    if (chat.length > MAX_MESSAGES) {
      hint = `This chat has ${chat.length} messages, so only the latest ${MAX_MESSAGES} are read. To read others, paste just that part of the chat.`;
      chat = chat.slice(-MAX_MESSAGES);
    }
    dispatch({ type: "start", messages: chat, hint });

    // Two messages at a time, each in its own fresh Gemma request.
    let next = 0;
    async function worker() {
      while (next < chat.length) await readOne(chat[next++]);
    }
    await Promise.all([worker(), worker()]);
    dispatch({ type: "finish" });
  }

  function startOver() {
    if (window.confirm("Clear the chat, the order, and all prices?")) dispatch({ type: "reset" });
  }

  async function upload(file: File | undefined) {
    if (file) dispatch({ type: "setText", text: await file.text() });
    if (fileInput.current) fileInput.current.value = "";
  }

  async function copy(key: string, value: string, extra = "") {
    if (await copyText(value)) {
      setManualCopy(null);
      setCopied(key);
      setNote(extra || null);
      setTimeout(() => setCopied(null), 2000);
    } else {
      setManualCopy(value);
      setNote("Couldn't copy automatically. Select the text below and copy it.");
    }
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
  const done = !state.building && total > 0;
  const groups = order.groups;

  // Bills: a merchant bills each customer; others make one bill (communities get a split).
  const isMerchant = profile?.role === "merchant";
  function makeBill(sender?: string) {
    if (!profile) {
      router.push(`/start?next=${encodeURIComponent("/build")}`);
      return;
    }
    const bill = buildBill({
      groups,
      prices,
      role: profile.role,
      from: isMerchant ? profile.name : shopName,
      to: sender ?? profile.name,
      sender,
    });
    if (saveBill(bill)) router.push(`/bill/${bill.id}`);
    else setNote("Couldn't save the bill in this browser. Check that storage isn't full or blocked.");
  }
  const problem = billProblem(groups, prices);
  const missingPrice = groups.filter((group) => group.totalQuantity > 0 && !(group.key in prices)).length;
  const leftOut = groups.filter((group) => group.totalQuantity === 0).length;

  return (
    <section id="build">
      <div className="wrap">
        <h2>Build a Parchi</h2>
        <p className="lead">Paste a chat — lines like “Rahul: 2 blue notebooks” work best.</p>
        <div className="two" style={{ marginTop: 28 }}>
          <div>
            <textarea
              id="chat"
              aria-label="WhatsApp chat"
              placeholder="Paste WhatsApp chat here..."
              value={state.text}
              onChange={(e) => dispatch({ type: "setText", text: e.target.value })}
              disabled={state.building}
            />
            <div className="ctas2">
              <button className="btn" type="button" onClick={() => dispatch({ type: "setText", text: SAMPLE_CHAT })} disabled={state.building}>
                Load sample chat
              </button>
              <button className="btn" type="button" onClick={() => fileInput.current?.click()} disabled={state.building}>
                Upload chat export
              </button>
              <input ref={fileInput} type="file" accept=".txt,text/plain" hidden onChange={(e) => upload(e.target.files?.[0])} />
              <button className="btn p" type="button" onClick={buildOrder} disabled={state.building}>
                Build order →
              </button>
              {(state.text || total > 0) && !state.building && (
                <button className="btn" type="button" onClick={startOver}>
                  Start over
                </button>
              )}
            </div>
            <div id="prog" role="status" aria-live="polite" style={{ marginTop: 12 }}>
              {state.building && (
                <>
                  Reading message {Math.min(finished + 1, total)} of {total}
                  <div className="bar">
                    <i style={{ width: `${(finished / total) * 100}%` }} />
                  </div>
                </>
              )}
              {done && (failed ? `Read ${total} messages. ${failed} couldn't be read: retry them.` : "Done — review the flagged rows.")}
              {state.hint && <p>{state.hint}</p>}
            </div>
          </div>

          <div id="res">
            {total > 0 && (
              <>
                <h3>How each message was read</h3>
                <div className="acc">
                  {state.messages.map((message) => {
                    const read = state.reads[message.id];
                    const outcome = order.messages[message.id];
                    const key = outcome?.status ?? (read && read.status !== "done" ? read.status : "waiting");
                    const [label, pill] = PILL[key];
                    return (
                      <div key={message.id} className="card" style={{ transform: "none" }}>
                        <div style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ overflowWrap: "anywhere" }}>
                            <b>{message.sender}</b> “{message.text}”
                          </span>
                          <span className={`st ${pill}`}>{label}</span>
                          {read?.status === "done" && <small style={{ flexBasis: "100%" }}>Gemma read → {describe(read.result)}</small>}
                          {outcome?.notes.map((text, i) => (
                            <small key={i} style={{ flexBasis: "100%" }}>
                              {text}
                            </small>
                          ))}
                          {read?.status === "failed" && (
                            <>
                              <small style={{ flexBasis: "100%" }}>{read.error}</small>
                              <button type="button" className="btn" style={{ padding: "6px 16px", minHeight: 40 }} onClick={() => readOne(message)}>
                                Retry
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <h3 style={{ margin: "28px 0 12px" }}>Your Parchi</h3>
                <div className="card order parchi-paper" style={{ transform: "none" }}>
                  {groups.length === 0 ? (
                    <p className="lead">{state.building ? "Reading…" : "No items found in this chat."}</p>
                  ) : (
                    groups.map((group) => <OrderRow key={group.key} group={group} onFix={(entryId, quantity) => dispatch({ type: "fix", entryId, quantity })} />)
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {done && groups.length > 0 && (
          <div className="two" style={{ marginTop: 40 }}>
            <div className="card" style={{ padding: 24, transform: "none" }}>
              <h3>Add prices</h3>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price ₹</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <tr key={group.key}>
                      <td>{itemLabel(group.name, group.variant)}</td>
                      <td>{group.entries.some((entry) => entry.quantity === null) ? `${group.totalQuantity} + ?` : group.totalQuantity}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={state.priceTexts[group.key] ?? ""}
                          onChange={(e) => dispatch({ type: "price", key: group.key, text: e.target.value })}
                          aria-label={`Price of one ${itemLabel(group.name, group.variant)}, in rupees`}
                        />
                      </td>
                      <td>{group.key in prices ? formatRupees(lineTotal(group, prices)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="lead" style={{ margin: 0 }}>
                Grand total
              </p>
              <div className="grand">{formatRupees(grandTotal(groups, prices))}</div>
              {missingPrice > 0 && <small>{plural(missingPrice, "item has", "items have")} no price yet.</small>}
              <h3 style={{ marginTop: 20 }}>Who owes what</h3>
              <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                {whoOwes(groups, prices).map(({ sender, amount }) => {
                  const customerProblem = isMerchant ? billProblem(groups, prices, sender) : null;
                  return (
                    <div key={sender} className="row">
                      <span>
                        {sender} — {formatRupees(amount)}
                      </span>
                      {isMerchant &&
                        (customerProblem ? (
                          <small style={{ marginLeft: "auto", fontWeight: 500 }}>{customerProblem}</small>
                        ) : (
                          <button type="button" className="btn" style={{ marginLeft: "auto", padding: "6px 16px", minHeight: 40 }} onClick={() => makeBill(sender)}>
                            Bill
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>

              <div className="ctas2" style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className={`btn p${copied === "shop" ? " ok" : ""}`}
                  onClick={() => copy("shop", shopText(groups), leftOut ? `${plural(leftOut, "item", "items")} without a quantity left out.` : "")}
                >
                  {copied === "shop" ? "✓ Copied!" : "Copy order for shop"}
                </button>
                <button type="button" className={`btn${copied === "owes" ? " ok" : ""}`} onClick={() => copy("owes", whoOwesText(groups, prices))}>
                  {copied === "owes" ? "✓ Copied!" : "Copy who owes what"}
                </button>
                <button type="button" className="btn" onClick={() => downloadText("parchi-order.csv", orderCsv(groups, prices))}>
                  Download CSV
                </button>
              </div>

              {!isMerchant && (
                <div style={{ marginTop: 20 }}>
                  <label htmlFor="bill-shop" style={{ display: "block", fontWeight: 700 }}>
                    Shop name on the bill (optional)
                  </label>
                  <div className="ctas2" style={{ marginTop: 8 }}>
                    <input
                      id="bill-shop"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      maxLength={40}
                      autoComplete="off"
                      style={{ flex: "1 1 180px", font: "500 1rem var(--ff)", padding: "10px 14px", border: "1.5px solid var(--bd)", borderRadius: 12, background: "var(--card2)", color: "var(--ink)", minHeight: 48 }}
                    />
                    <button type="button" className="btn p" onClick={() => makeBill()} disabled={problem !== null}>
                      {profile ? "Generate bill" : "Pick a role, then bill"}
                    </button>
                  </div>
                  {problem && <small>{problem}</small>}
                </div>
              )}

              <p role="status" style={{ marginTop: 10, minHeight: 24 }}>
                {note}
              </p>
              {manualCopy && (
                <textarea readOnly value={manualCopy} onFocus={(e) => e.target.select()} aria-label="Text to copy" style={{ minHeight: 120 }} />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// One item row in the design's style: name, total, a "Needs a check" pill, and each person's quantity box.
function OrderRow({ group, onFix }: { group: OrderGroup; onFix: (entryId: string, quantity: number | null) => void }) {
  const flagged = group.entries.some((entry) => entry.flagged);
  return (
    <div className={`it${flagged ? " flag" : ""}`}>
      <b>{itemLabel(group.name, group.variant).toUpperCase()}</b> · <span>{group.totalQuantity} total</span>{" "}
      {flagged && <span className="st s-n">? Needs a check</span>}
      {group.entries.map((entry) => (
        <div key={entry.id}>
          <div className="row">
            <span>{entry.sender}</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="?"
              value={entry.quantity ?? ""}
              onChange={(e) => {
                const value = e.target.value.trim();
                const quantity = Number(value);
                if (value === "") onFix(entry.id, null);
                else if (Number.isInteger(quantity) && quantity >= 0) onFix(entry.id, quantity);
              }}
              aria-label={`Quantity for ${entry.sender}, ${itemLabel(group.name, group.variant)}`}
            />
          </div>
          <small style={{ display: "block" }}>“{entry.source}”</small>
          {entry.flagged &&
            entry.notes.map((text, i) => (
              <small key={i} style={{ display: "block", fontWeight: 700 }}>
                {text}
              </small>
            ))}
        </div>
      ))}
    </div>
  );
}
