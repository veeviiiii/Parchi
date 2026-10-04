"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Builder, { LOAD_SAMPLE_EVENT } from "@/components/Builder";
import { LanguageMenu, ThemeMenu, useLanguage } from "@/components/Menus";
import { useProfile } from "@/lib/profile";

// The landing page, ported from the designer's HTML. Demo sections are static examples;
// the "Build a Parchi" section is the real app (components/Builder.tsx).

// Text that changes with the language menu. Only Hindi is translated; other languages show English.
const EN = {
  th: "Theme",
  lg: "Language",
  nf: "Features",
  nu: "How to use",
  nb: "Build a Parchi",
  h1a: "The ",
  h1b: " is for everyone.",
  cap: "Different language. Same meaning. Same parchi.",
  sub: "WhatsApp messages are messy.<br>Your orders don't have to be.",
  lead: "Parchi turns everyday conversations into clean, structured orders — understanding what was added, cancelled, or left unclear.",
  ts: "Try a sample chat",
  chaos: "From chaos to parchi.",
  feat: "Parchi understands the mess.",
  steps: "Three steps. One clean parchi.",
  fin: "Got a messy chat?",
};
const HI: Partial<typeof EN> = {
  th: "थीम",
  lg: "भाषा",
  nf: "फ़ीचर्स",
  nu: "कैसे इस्तेमाल करें",
  nb: "पर्ची बनाएँ",
  h1a: "",
  h1b: " हर किसी के लिए।",
  cap: "अलग भाषा। वही मतलब। वही पर्ची।",
  sub: "WhatsApp संदेश बिखरे होते हैं।<br>आपके ऑर्डर नहीं होने चाहिए।",
  lead: "Parchi रोज़मर्रा की बातचीत को साफ़, व्यवस्थित ऑर्डर में बदलता है — क्या जुड़ा, रद्द हुआ या अस्पष्ट रहा, सब समझते हुए।",
  ts: "सैंपल चैट आज़माएँ",
  chaos: "अव्यवस्था से पर्ची तक।",
  feat: "Parchi गड़बड़ी को समझता है।",
  steps: "तीन कदम। एक साफ़ पर्ची।",
  fin: "गड़बड़ चैट मिली?",
};

const ROT: [string, string][] = [
  ["Parchi", "en"],
  ["पर्ची", "hi"],
  ["ಪರ್ಚಿ", "kn"],
  ["પર્ચી", "gu"],
  ["পার্চি", "bn"],
];

// Demo data. Each example matches what Parchi really does (one message at a time, references get a check).
const INSPECT: [string, string, string, string][] = [
  ["Added", "a", "2 blue notebooks", "Add Blue Notebook × 2"],
  ["Needs a check", "n", "mere liye bhi same", "Refers to someone else's order — Parchi asks instead of guessing"],
  ["Cancelled", "c", "red pen nahi chahiye", "Remove Red Pen from the order"],
  ["Ignored", "i", "ok done 👍", "Not an order — nothing to add"],
  ["Needs a check", "n", "kuch pens bhi", "Pens requested, quantity missing — asking"],
];
const ICON: Record<string, [string, string]> = { a: ["🟢", "✓"], c: ["🔴", "✕"], i: ["⚪", "–"], n: ["🟡", "?"] };
const DEMO_ORDER: [string, [string, number, string][]][] = [
  ["Blue Notebook", [["Rahul", 3, "3 blue notebooks bhej dena"], ["Ayush", 2, "mere liye 2 blue notebook"]]],
  ["Black Pen", [["Sia", 4, "4 black pen"], ["Rahul", 3, "black pen 3 bhi"]]],
  ["A4 Sheets", [["Ayush", 2, "2 A4 sheets"]]],
];
const DEMO_PRICES: [string, number, number, Record<string, number>][] = [
  ["Blue Notebook", 5, 40, { Rahul: 3, Ayush: 2 }],
  ["Black Pen", 7, 10, { Rahul: 3, Sia: 4 }],
  ["A4 Sheets", 2, 85, { Ayush: 2 }],
];
const READY_TEXT = "Today's Parchi\n5 × Blue Notebook\n7 × Black Pen\n2 × A4 Sheets\nTotal — ₹440";

const reducedMotion = () => matchMedia("(prefers-reduced-motion:reduce)").matches;

function Mural({ className }: { className: string }) {
  return (
    <div className={`mural ${className}`} aria-hidden="true">
      <svg className="mc">
        <use href="#kc" />
      </svg>
      <svg className="mv">
        <use href="#kv" />
      </svg>
      <svg className="mo">
        <use href="#km" />
      </svg>
    </div>
  );
}

export default function Landing() {
  const { profile } = useProfile();
  const lang = useLanguage();
  const t = (key: keyof typeof EN) => (lang === "hi" ? (HI[key] ?? EN[key]) : EN[key]);
  const lines = (key: keyof typeof EN) =>
    t(key)
      .split("<br>")
      .flatMap((part, i) => (i === 0 ? [part] : [<br key={i} />, part]));

  const [rot, setRot] = useState(0);
  const [step, setStep] = useState(0);
  const [chip, setChip] = useState<number | null>(null);
  const [inspectOpen, setInspectOpen] = useState<Set<number>>(new Set());
  const [orderOpen, setOrderOpen] = useState<Set<number>>(new Set());
  const [prices, setPrices] = useState(DEMO_PRICES.map((p) => p[2]));
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const [readyCopied, setReadyCopied] = useState(false);

  // Rotating hero word and the "how to use" steps.
  useEffect(() => {
    if (reducedMotion()) return;
    const a = setInterval(() => setRot((i) => (i + 1) % ROT.length), 2400);
    const b = setInterval(() => setStep((i) => (i + 1) % 3), 2400);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);

  // Cursor glow, magnetic buttons, tilting cards, and reveal-on-scroll (from the design's script).
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(type, fn as EventListener);
      cleanups.push(() => el.removeEventListener(type, fn as EventListener));
    };
    if (matchMedia("(pointer:fine)").matches && !reducedMotion()) {
      const glow = document.getElementById("glow");
      const hero = document.getElementById("hero");
      on(window, "pointermove", (e) => {
        if (glow) glow.style.transform = `translate(${e.clientX - 260}px,${e.clientY - 260}px)`;
        if (hero) {
          const r = hero.getBoundingClientRect();
          hero.style.setProperty("--sx", `${e.clientX - r.left}px`);
          hero.style.setProperty("--sy", `${e.clientY - r.top}px`);
        }
      });
      document.querySelectorAll<HTMLElement>(".pl .mag").forEach((b) => {
        on(b, "pointermove", (e) => {
          const r = b.getBoundingClientRect();
          b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px,${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
        });
        on(b, "pointerleave", () => (b.style.transform = ""));
      });
      document.querySelectorAll<HTMLElement>(".pl .tilt").forEach((c) => {
        on(c, "pointermove", (e) => {
          const r = c.getBoundingClientRect();
          c.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 5}deg`);
          c.style.setProperty("--rx", `${-((e.clientY - r.top) / r.height - 0.5) * 5}deg`);
        });
        on(c, "pointerleave", () => {
          c.style.setProperty("--rx", "0deg");
          c.style.setProperty("--ry", "0deg");
        });
      });
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll<HTMLElement>(".pl .rv").forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 90}ms`;
      io.observe(el);
    });
    cleanups.push(() => io.disconnect());
    return () => cleanups.forEach((fn) => fn());
  }, []);

  // Demo prices: grand total counts up to the new value.
  const demoTotal = DEMO_PRICES.reduce((sum, p, i) => sum + p[1] * prices[i], 0);
  const owes: Record<string, number> = {};
  DEMO_PRICES.forEach((p, i) => {
    for (const [who, qty] of Object.entries(p[3])) owes[who] = (owes[who] ?? 0) + qty * prices[i];
  });
  useEffect(() => {
    const from = shownRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = reducedMotion() ? 1 : Math.min(1, (now - start) / 500);
      shownRef.current = Math.round(from + (demoTotal - from) * k);
      setShown(shownRef.current);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [demoTotal]);

  const toggle = (set: Set<number>, i: number) => {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  };

  return (
    <div className="pl">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <symbol id="kc" viewBox="0 0 240 170">
            <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 156H232" />
              <rect x="40" y="62" width="150" height="94" fill="currentColor" fillOpacity=".07" />
              <path d="M32 62L44 36H186L198 62Z" style={{ fill: "var(--ter)", fillOpacity: 0.3 }} />
              <path d="M32 62q9 12 18 0t18 0 18 0 18 0 18 0 18 0 18 0 18 0 18 0" />
              <rect x="62" y="12" width="106" height="21" rx="3" />
              <path d="M52 104H138V112H52M56 84H134M56 96H134" />
              <circle cx="66" cy="77" r="5" />
              <circle cx="82" cy="77" r="5" />
              <rect x="98" y="71" width="10" height="12" />
              <rect x="116" y="71" width="10" height="12" />
              <path d="M150 156V100h30v56M158 66v14M168 66v18" />
              <circle cx="206" cy="148" r="8" />
              <circle cx="226" cy="148" r="8" />
              <path d="M206 148l8-22h12" style={{ stroke: "var(--ter)" }} />
            </g>
            <text x="115" y="28" textAnchor="middle" fontFamily="Manrope,sans-serif" fontWeight="800" fontSize="13" fill="currentColor">
              KIRANA
            </text>
          </symbol>
          <symbol id="kv" viewBox="0 0 240 170">
            <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 157q110-3 220 0" />
              <path d="M36 157V58q84-6 168 0V157" fill="currentColor" fillOpacity=".08" />
              <path d="M30 58L120 24 210 58" />
              <rect x="58" y="34" width="124" height="22" rx="2" />
              <path d="M60 157V100q16-26 32 0V157M60 100h32" />
              <path d="M118 80h64v34h-64zM118 97h64M150 80v34" />
              <path d="M196 62v20M204 62v14" strokeDasharray="2 3" />
            </g>
            <text x="120" y="49" textAnchor="middle" fontFamily="Manrope,sans-serif" fontWeight="800" fontSize="10" fill="currentColor" letterSpacing="1">
              GENERAL STORES
            </text>
          </symbol>
          <symbol id="km" viewBox="0 0 240 170">
            <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square">
              <path d="M10 156H230M40 156V60H200V156M30 60H210M60 156V96H100V156M120 84H180V120H120ZM120 102H180" />
              <rect x="56" y="34" width="90" height="16" />
            </g>
          </symbol>
        </defs>
      </svg>
      <div id="glow" aria-hidden="true" />

      <nav aria-label="Main">
        <div className="wrap">
          <a className="logo" href="#top" style={{ fontSize: "1.6rem" }}>
            parchi<i>.</i>
          </a>
          <div className="ctl">
            <ThemeMenu label={t("th")} />
            <LanguageMenu label={t("lg")} />
            <a className="nl" href="#features">
              {t("nf")}
            </a>
            <a className="nl" href="#usage">
              {t("nu")}
            </a>
            <Link className="nl" href="/crowdmind">
              Crowdmind
            </Link>
            <a className="btn p mag" href="#build" style={{ padding: "8px 18px", minHeight: 44 }}>
              {t("nb")}
            </a>
          </div>
        </div>
      </nav>

      <main id="top">
        <header className="hero" id="hero">
          <Mural className="m-h" />
          <div className="wrap">
            <span className="pill">✦ AI-powered order intelligence</span>
            <h1 aria-label="The Parchi is for everyone.">
              <span>{t("h1a")}</span>
              <span className="rot" id="rot" aria-hidden="true">
                {ROT.map(([word, code], i) => (
                  <span key={code} lang={code} className={i === rot ? "on" : undefined}>
                    {word}
                  </span>
                ))}
              </span>
              <span>{t("h1b")}</span>
            </h1>
            <p className="cap">{t("cap")}</p>
            <p className="sub">{lines("sub")}</p>
            <p className="lead" style={{ margin: "14px auto 0" }}>
              {t("lead")}
            </p>
            <div className="ctas">
              <a className="btn p mag" href="#build">
                <span>{t("nb")}</span> <span className="ar">→</span>
              </a>
              <a className="btn mag" href="#build" id="trysample" onClick={() => dispatchEvent(new Event(LOAD_SAMPLE_EVENT))}>
                {t("ts")}
              </a>
            </div>
            <div className="stage">
              <span className="bub b1">&quot;2 blue notebooks bhej dena&quot;</span>
              <span className="bub b2">&quot;red pen cancel kar do&quot;</span>
              <span className="bub b3">&quot;5 black pen bhi&quot;</span>
              <div className="card tilt sheet">
                <h3>Today&apos;s Parchi</h3>
                <small>WhatsApp • 7 messages</small>
                <div className="row" style={{ marginTop: 10 }}>
                  ✓ Blue Notebook <b>2</b>
                </div>
                <div className="row">
                  ✓ Black Pen <b>5</b>
                </div>
                <div className="row">
                  ✓ A4 Sheets <b>2</b>
                </div>
                <div className="row x">
                  × Red Pen <b>Cancelled</b>
                </div>
                <div className="tot">
                  <span>Total items: 9</span>
                  <span>₹420</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section id="how">
          <Mural className="m-how" />
          <div className="wrap">
            <h2>{t("chaos")}</h2>
            <p className="lead">Parchi doesn&apos;t copy messages. It reads them.</p>
            <div className="chat2parchi rv">
              <div className="chat" role="img" aria-label="Chat: Rahul 3 blue notebooks; Ayush 2 blue notebooks for me; Rahul ok; Ayush black pen 2">
                <div className="msg">
                  <b>Rahul</b>3 blue notebooks
                </div>
                <div className="msg r">
                  <b>Ayush</b>mere liye 2 blue notebook
                </div>
                <div className="msg">
                  <b>Rahul</b>ok 👍
                </div>
                <div className="msg r">
                  <b>Ayush</b>black pen bhi 2
                </div>
              </div>
              <div className="flow" aria-label="Chat, parse, understand, organize">
                <span>READ</span>
                <span>UNDERSTAND</span>
                <span>VERIFY</span>
                <span>ORGANIZE</span>
              </div>
              <div className="card tilt out">
                <h3>Blue Notebook — 5</h3>
                <ul>
                  <li>Rahul — 3</li>
                  <li>Ayush — 2</li>
                </ul>
                <h3>Black Pen — 2</h3>
                <ul>
                  <li>Ayush — 2</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="features">
          <div className="wrap">
            <h2>{t("feat")}</h2>
            <div className="bento">
              <div className="card tilt c1 rv">
                <h3>Understands intent</h3>
                <p>Added, cancelled, ignored, or unclear — every message gets a clear status.</p>
              </div>
              <div className="card tilt c2 rv">
                <h3>Hindi + Hinglish</h3>
                <p>&quot;2 copy bhej dena&quot; becomes</p>
                <code>2 Notebooks</code>
              </div>
              <div className="card tilt c3 rv">
                <h3>No guessing</h3>
                <p>Someone says &quot;some pens&quot;? Parchi asks: how many?</p>
              </div>
              <div className="card tilt c4 rv">
                <h3>Handles cancels</h3>
                <p>&quot;Pen nahi chahiye ab&quot; removes that person&apos;s pens. &quot;Same as Rahul&quot;? It asks instead of guessing.</p>
              </div>
              <div className="card tilt c5 rv">
                <h3>Exact words</h3>
                <p>Every item shows the message it came from.</p>
              </div>
              <div className="card tilt c6 rv">
                <h3>Grouped orders</h3>
                <p>Many messages from many people become one clean order.</p>
              </div>
            </div>
          </div>
        </section>

        <div className="brk">
          <Mural className="inl" />
          <div className="sgw">
            <p className="sg1">Parchi bana do.</p>
          </div>
        </div>
        <div className="dark">
          <Mural className="m-d" />
          <div className="wrap rv">
            <h2>
              If Parchi doesn&apos;t know,
              <br />
              <em>it asks.</em>
            </h2>
            <div className="ask">
              <div className="msg">Some notebooks bhi bhejna.</div>
              <div className="q">
                <strong>⚠ Quantity unclear</strong>
                <p>How many notebooks should I add?</p>
                <div className="chips">
                  {["1", "2", "5", "Custom"].map((label, i) => (
                    <button key={label} type="button" className="chip" aria-pressed={chip === i} onClick={() => setChip(i)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p style={{ marginTop: 28, color: "#dfe3ee" }}>Parchi never invents an answer just to look smart.</p>
          </div>
        </div>

        <section>
          <div className="wrap two">
            <div className="rv">
              <h2>See how every message was read.</h2>
              <p className="lead">Tap a message to see what Parchi understood.</p>
              <div className="acc" id="insp">
                {INSPECT.map(([status, kind, text, meaning], i) => (
                  <div key={i} className={`card${inspectOpen.has(i) ? " open" : ""}`}>
                    <button type="button" aria-expanded={inspectOpen.has(i)} aria-controls={`d${i}`} onClick={() => setInspectOpen((s) => toggle(s, i))}>
                      <span aria-hidden="true">{ICON[kind][0]}</span>“{text}”
                      <span className={`st s-${kind}`}>
                        {ICON[kind][1]} {status}
                      </span>
                    </button>
                    <div className="det" id={`d${i}`}>
                      <div>
                        <p>
                          <b>Original message</b>
                          <br />“{text}”
                        </p>
                        <p>
                          <b>Parchi understood</b>
                          <br />
                          {meaning}
                        </p>
                        <p>
                          <b>Source words</b>
                          <br />“{text}”
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rv" id="sheet">
              <h2>
                One conversation.
                <br />
                One clean order.
              </h2>
              <div className="card order" id="order">
                {DEMO_ORDER.map(([item, people], i) => (
                  <div
                    key={item}
                    className={`it card${orderOpen.has(i) ? " open" : ""}`}
                    style={{ border: 0, boxShadow: "none", borderBottom: "1px dashed var(--bd)", borderRadius: 0, transform: "none" }}
                  >
                    <button
                      type="button"
                      style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", minHeight: 44 }}
                      aria-expanded={orderOpen.has(i)}
                      onClick={() => setOrderOpen((s) => toggle(s, i))}
                    >
                      <b>{item.toUpperCase()}</b>
                      <br />
                      {people.reduce((sum, p) => sum + p[1], 0)} total
                      <br />
                      <small>{people.map((p) => `${p[0]} · ${p[1]}`).join("  |  ")}</small>
                    </button>
                    <div className="det">
                      <div>
                        {people.map(([who, qty, quote]) => (
                          <p key={who} style={{ padding: "8px 0 0" }}>
                            <b>{who}</b> — qty {qty}
                            <br />“{quote}”
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <h2>Add prices. Know who owes what.</h2>
            <div className="two" style={{ marginTop: 20 }}>
              <div className="card" style={{ padding: 24, transform: "none" }}>
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
                    {DEMO_PRICES.map(([item, qty], i) => (
                      <tr key={item}>
                        <td>{item}</td>
                        <td>{qty}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={prices[i]}
                            aria-label={`Price of ${item}`}
                            onChange={(e) => setPrices((p) => p.map((v, j) => (j === i ? Number(e.target.value) || 0 : v)))}
                          />
                        </td>
                        <td>₹{qty * prices[i]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="lead" style={{ margin: 0 }}>
                  Grand total
                </p>
                <div className="grand">₹{shown}</div>
                <h3 style={{ marginTop: 20 }}>Who owes what</h3>
                <p style={{ fontSize: "1.15rem", fontWeight: 700 }}>
                  {Object.entries(owes).map(([who, amount], i) => (
                    <span key={who}>
                      {i > 0 && <br />}
                      {who} — ₹{amount}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className="card ready rv" style={{ transform: "none" }}>
              <h2>Ready to send.</h2>
              <pre>🧾 {READY_TEXT}</pre>
              <button
                type="button"
                className={`btn p${readyCopied ? " ok" : ""}`}
                onClick={() => {
                  navigator.clipboard?.writeText(READY_TEXT).catch(() => {});
                  setReadyCopied(true);
                  setTimeout(() => setReadyCopied(false), 2000);
                }}
              >
                {readyCopied ? "✓ Copied!" : "Copy order for shop"}
              </button>
            </div>
          </div>
        </section>

        <section id="usage">
          <div className="wrap">
            <h2>{t("steps")}</h2>
            <div className="steps">
              <div className={`card step${step === 0 ? " act" : ""}`}>
                <span className="n">01</span>
                <h3>Paste the chat</h3>
                <p>Paste your WhatsApp conversation.</p>
                <div className="msg">Rahul: 2 blue notebooks bhej dena</div>
              </div>
              <div className={`card step${step === 1 ? " act" : ""}`}>
                <span className="n">02</span>
                <h3>Build the parchi</h3>
                <p>Parchi reads and understands each message.</p>
                <div className="bar">
                  <i />
                </div>
              </div>
              <div className={`card step${step === 2 ? " act" : ""}`}>
                <span className="n">03</span>
                <h3>Review &amp; copy</h3>
                <p>Check flagged items, add prices, and copy the final order.</p>
                <div className="msg r">✓ Copied!</div>
              </div>
            </div>
          </div>
        </section>

        <Builder profile={profile} />

        <section id="trust">
          <div className="wrap">
            <h2>
              AI where it matters.
              <br />
              Code where it counts.
            </h2>
            <div className="split">
              <div className="card g tilt rv">
                <h3>Gemma</h3>
                <ul>
                  <li>Language understanding</li>
                  <li>Intent</li>
                  <li>Product extraction</li>
                  <li>Hindi / Hinglish</li>
                  <li>References</li>
                  <li>Ambiguity detection</li>
                </ul>
              </div>
              <div className="card e tilt rv">
                <h3>Parchi engine</h3>
                <ul>
                  <li>Validation</li>
                  <li>Grouping</li>
                  <li>Cancellation</li>
                  <li>Calculations</li>
                  <li>Order state</li>
                  <li>Hallucination protection</li>
                </ul>
              </div>
            </div>
            <p className="quote">
              Gemma understands the conversation.
              <br />
              Parchi makes sure the answer is grounded.
            </p>
          </div>
        </section>

        <div className="final" id="try">
          <Mural className="m-f" />
          <span className="bub" style={{ position: "absolute", left: "8%", top: "14%" }}>
            2 blue notebooks 📓
          </span>
          <span className="bub" style={{ position: "absolute", right: "8%", bottom: "16%" }}>
            pen nahi chahiye ab
          </span>
          <h2>{t("fin")}</h2>
          <p style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: 10 }}>Turn it into a parchi.</p>
          <a className="btn mag" href="#build">
            Build your first Parchi <span className="ar">→</span>
          </a>
        </div>
      </main>

      <footer>
        <div className="wrap">
          <a className="logo" href="#top" style={{ fontSize: "2rem" }}>
            parchi<i>.</i>
          </a>
          <p style={{ fontWeight: 700 }}>From chat to clarity.</p>
          <div className="links">
            <a href="#top">Product</a>
            <a href="#features">Features</a>
            <a href="#usage">How to Use</a>
            <Link href="/crowdmind">Crowdmind</Link>
            <a href="https://github.com/veeviiiii/Parchi">GitHub</a>
            <a href="#trust">About</a>
          </div>
          <small>Built with Gemma. Made for everyday chaos.</small>
        </div>
      </footer>
      <div className="sticky">
        <a className="btn p" href="#build">
          Build a Parchi →
        </a>
      </div>
    </div>
  );
}
